import { PrismaClient } from '../generated/prisma'

const prisma = new PrismaClient()

async function activateUser() {
  try {
    const user = await prisma.users.findFirst({
      where: { email: 'admin@demo.com' },
    })

    if (!user) {
      console.error('User not found')
      return
    }

    console.log('Current user status:', {
      email: user.email,
      is_active: user.is_active,
    })

    if (!user.is_active) {
      await prisma.users.update({
        where: { user_id: user.user_id },
        data: { is_active: true },
      })
      console.log('✅ User activated successfully')
    } else {
      console.log('✅ User is already active')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

activateUser()
