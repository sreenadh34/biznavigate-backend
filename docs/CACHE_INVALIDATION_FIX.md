# User Active Status Cache Invalidation - Permanent Fix

## Problem
The JWT strategy caches the user's `is_active` status for 5 minutes (300 seconds) to reduce database load. When a user's `is_active` status changes in the database, the cached value persists, causing authentication failures with "User account is inactive" error even though the database shows `is_active: true`.

## Root Cause
Cache key: `user:{user_id}:active`
- Located in: `src/features/auth/infrastructure/jwt.strategy.ts` (line 35)
- Cache TTL: 300000ms = 5 minutes (line 55)
- When user status changes, the old cached value remains until TTL expires

## Permanent Solution

### 1. **Cache Invalidation on User Update** ✅ IMPLEMENTED
**File**: `src/features/users/applications/user.service.ts`

Added cache invalidation in:
- `updateUser()` method (lines 39-42)
- `updateProfile()` method (lines 108-110) - Already existed

```typescript
// Clear the user cache after update to refresh is_active status
const cacheKey = `user:${user_id}:active`;
await this.cacheManager.del(cacheKey);
```

### 2. **Manual Cache Clear When Needed**
If you need to manually clear the cache (e.g., when updating via Prisma Studio):

```bash
redis-cli FLUSHALL
```

Or clear specific user cache:
```bash
redis-cli DEL "user:{user_id}:active"
```

### 3. **Prevention Best Practices**

#### Always use UserService methods
Never update users directly with Prisma in application code. Always use:
```typescript
// ✅ CORRECT
await this.usersService.updateUser(userId, { is_active: true });

// ❌ WRONG - bypasses cache invalidation
await this.prisma.users.update({
  where: { user_id: userId },
  data: { is_active: true }
});
```

#### Locations that update users directly
The following files update users directly via Prisma and may need cache invalidation if they modify `is_active`:

1. **Auth Service** (`src/features/auth/application/services/auth.service.ts`)
   - Updates failed login attempts and account locks
   - Does NOT update `is_active`, so no cache invalidation needed

2. **Users Repository** (`src/features/users/applications/infrastructure/users.repository.prisma.ts`)
   - All updates go through UserService which has cache invalidation

3. **Scripts** (development/maintenance scripts)
   - `scripts/activate-user.ts`
   - `scripts/fix-user-is-active.ts`
   - These should manually clear cache or restart the app after running

## Future Improvements

### Option A: Reduce Cache TTL
If user status changes frequently, consider reducing the cache TTL:

```typescript
// In jwt.strategy.ts line 55
await this.cacheManager.set(cacheKey, isUserActive, 60000); // 1 minute instead of 5
```

### Option B: Event-Based Cache Invalidation
Implement a pub/sub pattern using Redis:
1. Emit event when user is updated
2. Subscribe to events and invalidate cache
3. Works across multiple app instances

### Option C: Remove Caching for is_active
If performance is not critical, remove caching entirely:

```typescript
// In jwt.strategy.ts - always query database
const user = await this.prisma.users.findUnique({
  where: { user_id: payload.user_id },
  select: { is_active: true },
});

if (!user || !user.is_active) {
  throw new UnauthorizedException('User account is inactive');
}
```

## Testing the Fix

1. **Update user via API**:
   ```bash
   curl -X PATCH http://localhost:3006/users/{user_id} \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"is_active": true}'
   ```

2. **Verify cache was cleared**:
   ```bash
   redis-cli GET "user:{user_id}:active"
   # Should return (nil) if cache was cleared
   ```

3. **Test authentication**:
   ```bash
   curl -X GET http://localhost:3006/instagram/auth/url \
     -H "Authorization: Bearer {token}"
   # Should succeed without "User account is inactive" error
   ```

## Related Files
- JWT Strategy: `src/features/auth/infrastructure/jwt.strategy.ts`
- User Service: `src/features/users/applications/user.service.ts`
- Cache Manager: Injected via `@nestjs/cache-manager`
- Redis: Running on `localhost:6379` via docker-compose

## Emergency Recovery
If users are locked out due to cache issues:

```bash
# Clear all Redis cache
redis-cli FLUSHALL

# Or restart Redis
docker restart biznavigate-redis

# Or restart the application
npm run start:dev
```

---

**Last Updated**: December 10, 2025
**Status**: ✅ Fixed and Tested
