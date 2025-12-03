# SME Lead Management Workflow

This document outlines the simplified lead management workflow designed for small and medium enterprises (SMEs).

## Simplified Lead Statuses

For SME businesses, we use a simplified 3-stage lead status system:

### 1. **new** (Blue)
- Lead just came in
- No interaction yet
- Needs immediate attention

### 2. **replied** (Yellow) / **contacted**
- You've started talking to the customer
- Conversation is active
- Working on closing the sale

### 3. **converted** (Green) / **won**
- Customer made a purchase
- Sale completed
- Success!

### Optional: **lost** (Gray)
- Customer not interested
- Deal didn't work out

## Lead Sources

Simplified to 3 main channels:

- **instagram** - Includes comments and DMs
- **whatsapp** - WhatsApp inquiries
- **website** - Website forms and chat

> Note: The system still accepts the detailed sources (`instagram_comment`, `instagram_dm`, `website_form`) for backward compatibility.

## Key Features for SMEs

### ✅ Quick View
- See all leads at a glance
- Color-coded status badges
- Deal value prominently displayed

### ✅ Easy Contact
- One-click WhatsApp chat
- Direct phone call
- See customer phone & email immediately

### ✅ Simple Search
- Search by name, phone, or product
- No complex filters needed
- Find what you need fast

### ✅ Essential Info Only
- Customer name & contact
- What they're interested in
- Deal value
- When they contacted you
- Current status

## API Response Format

```json
{
  "id": "uuid",
  "name": "Customer Name",
  "phone": "+91 98765 43210",
  "email": "customer@email.com",
  "source": "whatsapp",
  "product": "Red Kurti",
  "status": "new",
  "time": "2m ago",
  "value": "₹2,499"
}
```

## Dashboard Stats

4 key metrics that matter:

1. **Total** - Total number of leads
2. **New** - Leads waiting for response
3. **Active** - Leads in conversation
4. **Sales** - Converted customers

## Best Practices for SMEs

1. **Respond to "new" leads within 5 minutes** - Fast response = better conversion
2. **Move to "replied" once you start chatting** - Keep track of active conversations
3. **Mark as "converted" when sale is done** - Celebrate wins!
4. **Use WhatsApp button** - Most customers prefer WhatsApp in India

## Why This Workflow?

Traditional CRM systems have 7-10 status stages (qualified, proposal, negotiation, etc.) which are:
- ❌ Too complex for SME owners
- ❌ Time-consuming to maintain
- ❌ Confusing for small teams

Our simplified 3-stage system:
- ✅ Easy to understand
- ✅ Quick to use
- ✅ Focuses on action, not paperwork
- ✅ Perfect for businesses with 1-20 employees
