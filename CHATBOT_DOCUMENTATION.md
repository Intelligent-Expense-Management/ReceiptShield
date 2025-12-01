# ReceiptShield Chatbot Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Components](#key-components)
4. [How It Works](#how-it-works)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Features & Capabilities](#features--capabilities)
8. [Integration Points](#integration-points)
9. [Error Handling](#error-handling)
10. [Troubleshooting](#troubleshooting)
11. [Future Improvements](#future-improvements)
12. [Development Guide](#development-guide)

---

## Overview

The ReceiptShield Chatbot is an AI-powered conversational assistant integrated throughout the application. It helps users with expense management, receipt queries, budget optimization, and provides contextual assistance based on their role and receipt history.

### Key Features

- **Context-Aware Responses**: Uses user's receipt history to provide personalized answers
- **Role-Based Context**: Different context for employees, managers, and admins
- **Smart Suggestions**: Can suggest actions like uploading receipts
- **Rate Limit Handling**: Graceful handling of API rate limits with retry logic
- **Multi-Model Support**: Configurable Google Gemini models
- **Platform Admin Configuration**: Settings can be managed through Firestore or environment variables

### Technology Stack

- **Frontend**: React, Next.js, TypeScript
- **AI Service**: Google Gemini API (via REST)
- **Storage**: Firestore for settings and receipt history
- **UI Components**: Radix UI (Sheet, ScrollArea, etc.)

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Sidebar    │  │   Header     │  │  Full Page   │      │
│  │   Button     │  │   Button     │  │  Assistant  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Chatbot Component                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Message State Management                            │   │
│  │  • User Input Handling                                 │   │
│  │  • Receipt History Fetching (role-based)              │   │
│  │  • UI Rendering (Sheet, Messages, Input)              │   │
│  └───────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Assistant Flow                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  runAssistant(message, receiptHistory)                │   │
│  │  • Calls API endpoint                                 │   │
│  │  • Handles errors gracefully                          │   │
│  │  • Returns formatted response                         │   │
│  └───────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    API Route (/api/ai-assistant)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Loads AI settings (Firestore → Env vars)           │   │
│  │  • Builds context-aware prompt                       │   │
│  │  • Calls Google Gemini API                           │   │
│  │  • Retry logic for rate limits                       │   │
│  │  • Error handling & fallbacks                         │   │
│  └───────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Google Gemini API                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Generates AI response                              │   │
│  │  • Returns text content                               │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Input** → Chatbot component receives user message
2. **Context Gathering** → Fetches relevant receipts based on user role
3. **API Call** → Sends message + receipt history to `/api/ai-assistant`
4. **Settings Load** → API loads AI settings (Firestore or env vars)
5. **Prompt Building** → Constructs context-aware prompt with user question and receipt history
6. **Gemini API Call** → Sends request to Google Gemini with retry logic
7. **Response Processing** → Formats response and determines if upload should be suggested
8. **UI Update** → Chatbot displays response to user

---

## Key Components

### 1. Chatbot Component (`src/components/shared/chatbot.tsx`)

**Purpose**: Main UI component for the chatbot interface.

**Key Features**:
- Sheet-based modal interface (slides in from right)
- Message history management
- Auto-scrolling to latest message
- Loading states during AI response
- Action buttons (e.g., "Upload a Receipt")
- Role-based receipt history fetching

**Props**:
```typescript
interface ChatbotProps {
  isOpen: boolean;      // Controls visibility
  onClose: () => void;   // Callback to close chatbot
}
```

**State Management**:
- `messages`: Array of message objects (user/assistant)
- `input`: Current user input
- `isResponding`: Loading state during API call

**Key Functions**:
- `handleSubmit()`: Processes user message, fetches receipt history, calls AI
- Receipt history fetching based on user role:
  - **Admin**: All receipts (`getAllReceipts()`)
  - **Manager**: Team receipts (`getReceiptsForManager()`)
  - **Employee**: Personal receipts (`getAllReceiptsForUser()`)

### 2. Assistant Flow (`src/ai/flows/assistant-flow.ts`)

**Purpose**: Client-side wrapper for calling the AI assistant API.

**Key Function**:
```typescript
runAssistant(
  message: string,
  receiptHistory?: string
): Promise<{
  response: string;
  error: string | null;
  suggestUpload: boolean;
}>
```

**Features**:
- Handles API errors gracefully
- Special handling for rate limit errors (429)
- Returns user-friendly error messages
- Network error detection

### 3. API Route (`src/app/api/ai-assistant/route.ts`)

**Purpose**: Server-side API endpoint that handles AI requests.

**Key Responsibilities**:
1. **Settings Management**:
   - Tries Firestore first (`getAISettingsAdmin()`)
   - Falls back to environment variables
   - Supports multiple env var names: `GOOGLE_AI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`

2. **Prompt Building**:
   - Creates context-aware prompt
   - Includes user question
   - Includes receipt history if available
   - Sets AI personality and instructions

3. **API Communication**:
   - Calls Google Gemini REST API
   - Handles retry logic (3 attempts)
   - Exponential backoff for rate limits
   - Respects `Retry-After` headers

4. **Response Processing**:
   - Extracts text from Gemini response
   - Determines if upload should be suggested
   - Returns formatted response

**Request Body**:
```typescript
{
  message: string;           // User's question
  receiptHistory?: string;    // JSON string of receipt history
}
```

**Response**:
```typescript
{
  response: string;           // AI-generated response
  error: string | null;       // Error code if any
  suggestUpload: boolean;     // Whether to show upload button
}
```

### 4. AI Settings Store (`src/lib/firebase-ai-settings-store.ts`)

**Purpose**: Manages AI configuration in Firestore.

**Key Functions**:
- `getAISettings()`: Client-side retrieval
- `getAISettingsAdmin()`: Server-side retrieval (Admin SDK)
- `updateAISettings()`: Client-side update
- `updateAISettingsAdmin()`: Server-side update
- `getAvailableModels()`: Returns list of supported Gemini models

**Firestore Structure**:
```
platform_settings/
  └── ai_settings/
      ├── geminiApiKey: string
      ├── geminiModel: string
      ├── updatedAt: timestamp
      └── updatedBy: string
```

**Settings Priority**:
1. Firestore settings (if exists)
2. Environment variables
3. Default model: `gemini-2.0-flash`

### 5. Integration Points

**Sidebar Integration** (`src/components/shared/modern-sidebar.tsx`):
- Chatbot button in sidebar
- State management for chatbot open/close
- Toggle handler

**Header Integration** (`src/components/shared/app-header.tsx`):
- Optional chatbot button in header
- `onChatbotClick` prop

**Layout Integration** (`src/app/(app)/layout.tsx`):
- Global chatbot instance
- Accessible from anywhere in app

**Role-Specific Pages**:
- `src/app/(app)/employee/ai-assistant/page.tsx`: Full-page employee assistant
- `src/app/(app)/manager/ai-assistant/page.tsx`: Full-page manager assistant

---

## How It Works

### Step-by-Step Flow

#### 1. User Opens Chatbot

```typescript
// User clicks chatbot button
handleChatbotToggle() → setIsChatbotOpen(true)
```

**Initialization**:
- Chatbot component mounts
- Initial welcome message displayed
- Receipt history not yet loaded

#### 2. User Sends Message

```typescript
// User types message and submits
handleSubmit(e) → 
  - Creates user message object
  - Adds to messages state
  - Clears input
  - Sets isResponding = true
```

#### 3. Receipt History Fetching

```typescript
// Role-based receipt fetching
if (user.role === 'admin') {
  relevantReceipts = await getAllReceipts();
} else if (user.role === 'manager') {
  relevantReceipts = await getReceiptsForManager(user.id);
} else {
  relevantReceipts = await getAllReceiptsForUser(user.email);
}
```

**Receipt History Format**:
```typescript
[
  {
    fileName: string,
    status: 'pending_approval' | 'approved' | 'rejected' | 'flagged' | 'clear',
    uploaded_at: string,  // ISO timestamp
    uploadedBy: string   // User email
  },
  // ... more receipts
]
```

#### 4. API Call

```typescript
// Calls assistant flow
const result = await runAssistant(input, receiptHistoryString);
```

**What happens in `runAssistant()`**:
1. Makes POST request to `/api/ai-assistant`
2. Sends `{ message, receiptHistory }`
3. Waits for response
4. Handles errors (rate limits, network, etc.)
5. Returns formatted result

#### 5. API Route Processing

```typescript
// In /api/ai-assistant/route.ts
POST(request) →
  1. Parse request body
  2. Load AI settings (Firestore → env vars)
  3. Validate API key
  4. Build prompt with context
  5. Call Gemini API (with retries)
  6. Process response
  7. Return JSON
```

**Prompt Structure**:
```
You are a helpful AI assistant for ReceiptShield, an expense management 
and fraud detection platform. Your role is to assist users with questions 
about their expenses, receipts, and financial management.

User's Question: [user message]

User's Receipt History Context:
[JSON string of receipt history]

Please provide a helpful, concise, and professional response...
```

#### 6. Gemini API Call

```typescript
// API configuration
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const requestBody = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 512,
  }
};
```

**Retry Logic**:
- Max 3 retries for rate limit errors (429)
- Exponential backoff: 2s, 5s, 10s
- Respects `Retry-After` header if present
- Provides fallback responses for common questions

#### 7. Response Processing

```typescript
// Extract response from Gemini
const assistantResponse = data.candidates[0].content.parts[0].text;

// Determine if upload should be suggested
const suggestUpload = 
  message.toLowerCase().includes('upload') ||
  message.toLowerCase().includes('receipt') ||
  message.toLowerCase().includes('submit') ||
  message.toLowerCase().includes('add expense');
```

#### 8. UI Update

```typescript
// Add assistant message to chat
const assistantMessage: Message = {
  id: (Date.now() + 1).toString(),
  role: 'assistant',
  content: result.response,
  action: result.suggestUpload ? {
    label: 'Upload a Receipt',
    onClick: () => router.push('/employee/upload')
  } : undefined
};

setMessages(prev => [...prev, assistantMessage]);
setIsResponding(false);
```

---

## Configuration

### Environment Variables

**Required** (at least one):
```env
GOOGLE_AI_API_KEY=your_api_key_here
# OR
GEMINI_API_KEY=your_api_key_here
# OR
GOOGLE_API_KEY=your_api_key_here
```

**Optional**:
```env
GEMINI_MODEL=gemini-2.0-flash  # Default model if not set in Firestore
```

### Firestore Configuration

Platform admins can configure AI settings through the admin panel:

**Path**: `/platform/ai-settings`

**Settings**:
- `geminiApiKey`: Google AI API key
- `geminiModel`: Model to use (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`)

**Priority**:
1. Firestore settings (if configured)
2. Environment variables
3. Default model: `gemini-2.0-flash`

### Available Models

```typescript
[
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-pro-preview-03-25',
]
```

**Model Selection Guidelines**:
- **Flash models**: Faster, cheaper, good for simple queries
- **Pro models**: More capable, better for complex reasoning
- **Experimental models**: Latest features, may have stricter rate limits

### Getting a Google AI API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key
5. Add to `.env.local` or Firestore settings

---

## API Reference

### POST `/api/ai-assistant`

**Endpoint**: `/api/ai-assistant`

**Method**: `POST`

**Authentication**: None (but uses user context from request)

**Request Body**:
```typescript
{
  message: string;           // Required: User's question
  receiptHistory?: string;   // Optional: JSON string of receipt history
}
```

**Response**:
```typescript
{
  response: string;          // AI-generated response
  error: string | null;      // Error code if any
  suggestUpload: boolean;    // Whether to show upload action button
}
```

**Status Codes**:
- `200`: Success
- `429`: Rate limit exceeded (with helpful message)
- `401/403`: Authentication error
- `500`: Server error

**Example Request**:
```typescript
const response = await fetch('/api/ai-assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What are my expenses this month?",
    receiptHistory: JSON.stringify([...])
  })
});
```

**Example Response**:
```json
{
  "response": "Based on your receipt history, you've spent $1,234.56 this month across 15 receipts. Your top category is Meals (45%), followed by Transportation (30%).",
  "error": null,
  "suggestUpload": false
}
```

---

## Features & Capabilities

### 1. Context-Aware Responses

The chatbot uses receipt history to provide personalized answers:

**Example**:
- User: "What did I spend on meals last month?"
- AI receives receipt history with meal receipts
- AI responds with specific amounts and details

### 2. Role-Based Context

Different users get different context:

- **Employee**: Only their own receipts
- **Manager**: All receipts from their team
- **Admin**: All company receipts

### 3. Smart Action Suggestions

The chatbot can suggest actions based on the conversation:

**Upload Suggestion**:
- Triggered when user asks about uploading/submitting receipts
- Shows "Upload a Receipt" button
- Navigates to upload page when clicked

### 4. Rate Limit Handling

**Features**:
- Automatic retry with exponential backoff
- Respects `Retry-After` headers
- User-friendly error messages
- Fallback responses for common questions

**Retry Strategy**:
1. First retry: Wait 2 seconds
2. Second retry: Wait 5 seconds
3. Third retry: Wait 10 seconds
4. If `Retry-After` header present: Use that value

### 5. Error Recovery

**Network Errors**:
- Detects network failures
- Provides helpful message
- Suggests checking internet connection

**API Errors**:
- Authentication errors: Suggests contacting support
- Rate limits: Explains the issue and suggests waiting
- Invalid responses: Graceful fallback

### 6. Message Formatting

**Features**:
- Markdown support (bold text with `**text**`)
- Line breaks preserved
- HTML rendering for formatting
- Auto-scrolling to latest message

---

## Integration Points

### 1. Sidebar Integration

**File**: `src/components/shared/modern-sidebar.tsx`

**Usage**:
```typescript
import { Chatbot } from "@/components/shared/chatbot";

const [isChatbotOpen, setIsChatbotOpen] = useState(false);

// In JSX:
<Button onClick={() => setIsChatbotOpen(true)}>
  AI Assistant
</Button>

<Chatbot 
  isOpen={isChatbotOpen} 
  onClose={() => setIsChatbotOpen(false)} 
/>
```

### 2. Header Integration

**File**: `src/components/shared/app-header.tsx`

**Usage**:
```typescript
<AppHeader onChatbotClick={() => setChatbotOpen(true)} />
```

### 3. Layout Integration

**File**: `src/app/(app)/layout.tsx`

**Usage**:
```typescript
const [isChatbotOpen, setChatbotOpen] = useState(false);

// Global chatbot instance
<Chatbot 
  isOpen={isChatbotOpen} 
  onClose={() => setChatbotOpen(false)} 
/>

// Trigger from anywhere:
<Button onClick={() => setChatbotOpen(true)}>Open Chat</Button>
```

### 4. Receipt Store Integration

**Files**:
- `src/lib/receipt-store.ts`
- `src/lib/firebase-receipt-store.ts`

**Functions Used**:
- `getAllReceipts()`: All receipts (admin)
- `getReceiptsForManager(managerId)`: Team receipts (manager)
- `getAllReceiptsForUser(email)`: User receipts (employee)

---

## Error Handling

### Error Types

#### 1. API Key Not Configured

**Error**: `API_KEY_NOT_CONFIGURED`

**Message**: 
> "I apologize, but the AI assistant is currently unavailable. Please configure the Google AI API key (GOOGLE_AI_API_KEY) in your environment variables to enable AI assistance."

**Solution**: Add API key to `.env.local` or Firestore settings

#### 2. Rate Limit Exceeded

**Error**: `RATE_LIMIT_EXCEEDED`

**Message**: 
> "I'm currently experiencing high demand. Please wait a moment and try again in a few seconds. Rate limits help ensure fair access for all users."

**Behavior**:
- Automatic retry with backoff
- Fallback responses for common questions
- User-friendly explanation

**Solutions**:
- Wait and retry
- Upgrade API quota
- Switch to paid tier
- See `GEMINI_RATE_LIMIT_SOLUTIONS.md` for details

#### 3. Network Errors

**Error**: Network/fetch failures

**Message**: 
> "I'm having trouble connecting to the AI service. Please check your internet connection and try again."

**Behavior**: Detected in `runAssistant()` catch block

#### 4. Authentication Errors

**Error**: `401` or `403`

**Message**: 
> "I'm sorry, there's an authentication issue with the AI service. Please contact support."

**Solution**: Check API key validity

#### 5. Invalid Response

**Error**: `Invalid response from Gemini API`

**Message**: 
> "I'm sorry, I received an invalid response from the AI service. Please try again."

**Behavior**: When Gemini response structure is unexpected

### Error Handling Flow

```
User Message
    ↓
runAssistant()
    ↓
API Call
    ↓
┌─────────────────┐
│  Success?       │
└────┬────────────┘
     │
     ├─ Yes → Return response
     │
     └─ No → Check error type
              │
              ├─ 429 → Retry (max 3x) → Fallback message
              ├─ 401/403 → Auth error message
              ├─ Network → Network error message
              └─ Other → Generic error message
```

---

## Troubleshooting

### Common Issues

#### 1. Chatbot Not Responding

**Symptoms**: Messages sent but no response

**Check**:
1. Browser console for errors
2. Network tab for API calls
3. API key configured correctly
4. Environment variables loaded

**Solutions**:
- Verify API key in `.env.local`
- Check Firestore settings if using platform admin config
- Restart dev server after env var changes
- Check browser console for specific errors

#### 2. Rate Limit Errors

**Symptoms**: Frequent "high demand" messages

**Solutions**:
- See `GEMINI_RATE_LIMIT_SOLUTIONS.md`
- Upgrade to paid API tier
- Switch to stable model (not experimental)
- Implement request caching
- Add request throttling

#### 3. No Receipt Context

**Symptoms**: AI doesn't reference user's receipts

**Check**:
1. Receipt fetching functions working
2. User has receipts in database
3. User role is correct
4. Receipt history being passed to API

**Debug**:
```typescript
// In chatbot.tsx, add logging:
console.log('Receipts fetched:', relevantReceipts);
console.log('Receipt history string:', receiptHistoryString);
```

#### 4. Settings Not Updating

**Symptoms**: Changes in Firestore/env vars not taking effect

**Solutions**:
- Restart dev server after env var changes
- Clear Firestore cache
- Check settings priority (Firestore > Env > Default)
- Verify Firestore document exists: `platform_settings/ai_settings`

#### 5. Chatbot Not Opening

**Symptoms**: Button click does nothing

**Check**:
1. `isOpen` state management
2. `onClose` callback defined
3. Chatbot component imported correctly
4. No JavaScript errors in console

**Debug**:
```typescript
// Add logging to toggle handler:
const handleChatbotToggle = () => {
  console.log('Toggle clicked, current state:', isChatbotOpen);
  setIsChatbotOpen(!isChatbotOpen);
};
```

### Debugging Tips

#### 1. Enable Detailed Logging

**In API route** (`src/app/api/ai-assistant/route.ts`):
```typescript
console.log('🤖 AI Assistant Request received');
console.log('Message:', message);
console.log('Receipt history:', receiptHistory);
console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
console.log('Using model:', model);
```

#### 2. Test API Directly

```bash
curl -X POST http://localhost:9003/api/ai-assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

#### 3. Check Firestore Settings

```typescript
// In browser console or server code:
import { getAISettings } from '@/lib/firebase-ai-settings-store';
const settings = await getAISettings();
console.log('AI Settings:', settings);
```

#### 4. Monitor Network Requests

- Open browser DevTools → Network tab
- Filter by "ai-assistant"
- Check request/response details
- Look for error status codes

---

## Future Improvements

### Potential Enhancements

#### 1. Conversation History

**Current**: No persistent conversation history

**Improvement**: Store conversations in Firestore
- User can see past conversations
- Context persists across sessions
- Better continuity

**Implementation**:
```typescript
// Store in Firestore
conversations/{userId}/{conversationId}/
  messages: [
    { role: 'user', content: '...', timestamp: '...' },
    { role: 'assistant', content: '...', timestamp: '...' }
  ]
```

#### 2. Streaming Responses

**Current**: Wait for complete response

**Improvement**: Stream tokens as they're generated
- Better UX (feels faster)
- Shows progress
- More engaging

**Implementation**:
- Use Gemini streaming API
- Server-Sent Events (SSE) or WebSocket
- Update UI as tokens arrive

#### 3. Multi-Turn Conversations

**Current**: Each message is independent

**Improvement**: Maintain conversation context
- Reference previous messages
- Follow-up questions work better
- More natural conversation

**Implementation**:
- Send conversation history to API
- Maintain message thread in state
- Include previous messages in prompt

#### 4. Receipt-Specific Queries

**Current**: General receipt history context

**Improvement**: Allow querying specific receipts
- "Show me receipt from Starbucks on Jan 15"
- "What was the total for that Amazon purchase?"
- Link to specific receipts in responses

**Implementation**:
- Parse receipt queries
- Fetch specific receipt details
- Include receipt data in prompt
- Add links to receipt detail pages

#### 5. Analytics Integration

**Current**: No analytics on chatbot usage

**Improvement**: Track usage patterns
- Most common questions
- Response times
- Error rates
- User satisfaction

**Implementation**:
- Log queries to analytics service
- Track metrics in Firestore
- Dashboard for insights

#### 6. Custom Prompts per Role

**Current**: Same prompt for all roles

**Improvement**: Role-specific prompts
- Employee: Focus on personal expenses
- Manager: Focus on team management
- Admin: Focus on company-wide insights

**Implementation**:
```typescript
const getRolePrompt = (role: string) => {
  const prompts = {
    employee: "You are helping an employee manage their expenses...",
    manager: "You are helping a manager oversee team expenses...",
    admin: "You are helping an admin manage company expenses..."
  };
  return prompts[role] || prompts.employee;
};
```

#### 7. Voice Input

**Current**: Text-only input

**Improvement**: Voice-to-text input
- Speak questions instead of typing
- Better mobile experience
- Accessibility improvement

**Implementation**:
- Web Speech API
- Mobile native speech recognition
- Convert speech to text before sending

#### 8. Export Conversations

**Current**: No way to save conversations

**Improvement**: Export chat history
- PDF export
- Email summary
- CSV for analysis

#### 9. Proactive Suggestions

**Current**: Reactive (only responds to questions)

**Improvement**: Proactive assistance
- "I noticed you haven't uploaded receipts this week"
- "Your spending is 20% higher than last month"
- "You have 3 receipts pending approval"

#### 10. Integration with Other Features

**Current**: Standalone chatbot

**Improvement**: Deep integration
- Link to analytics from responses
- Create reports from chat
- Set up alerts from conversation
- Navigate to relevant pages

---

## Development Guide

### Adding New Features

#### 1. Adding a New Action Button

**Example**: Add "View Analytics" button

**Step 1**: Update API response type
```typescript
// In assistant-flow.ts
interface AssistantResponse {
  response: string;
  error: string | null;
  suggestUpload: boolean;
  suggestAnalytics?: boolean;  // New field
}
```

**Step 2**: Update API route
```typescript
// In /api/ai-assistant/route.ts
const suggestAnalytics = 
  message.toLowerCase().includes('analytics') ||
  message.toLowerCase().includes('report') ||
  message.toLowerCase().includes('statistics');

return NextResponse.json({
  response: assistantResponse,
  error: null,
  suggestUpload,
  suggestAnalytics  // Include in response
});
```

**Step 3**: Update Chatbot component
```typescript
// In chatbot.tsx
if (result.suggestAnalytics) {
  assistantMessage.action = {
    label: 'View Analytics',
    onClick: () => {
      router.push('/employee/analytics');
      onClose();
    },
  };
}
```

#### 2. Adding Custom Prompts

**Location**: `src/app/api/ai-assistant/route.ts`

**Modify prompt building**:
```typescript
let prompt = `You are a helpful AI assistant for ReceiptShield...

// Add custom instructions
${customInstructions}

User's Question: ${message}
...`;
```

#### 3. Adding Receipt Details to Context

**Current**: Only receipt metadata

**Enhancement**: Include full receipt data

```typescript
// In chatbot.tsx
const receiptHistoryString = JSON.stringify(
  relevantReceipts.map(r => ({
    fileName: r.fileName,
    amount: r.items.reduce((sum, item) => sum + item.price, 0),
    vendor: r.items[0]?.vendor || 'Unknown',
    date: r.uploadedAt,
    status: r.status,
    items: r.items.map(item => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }))
  }))
);
```

### Testing

#### 1. Unit Tests

**Test assistant flow**:
```typescript
// tests/assistant-flow.test.ts
describe('runAssistant', () => {
  it('should handle successful response', async () => {
    // Mock API response
    // Test response parsing
  });
  
  it('should handle rate limit errors', async () => {
    // Mock 429 response
    // Test retry logic
  });
});
```

#### 2. Integration Tests

**Test full flow**:
```typescript
// tests/chatbot-integration.test.ts
describe('Chatbot Integration', () => {
  it('should send message and receive response', async () => {
    // Test user input → API call → response display
  });
});
```

#### 3. Manual Testing Checklist

- [ ] Chatbot opens/closes correctly
- [ ] Messages send and display
- [ ] Receipt history included in context
- [ ] Role-based context works (employee/manager/admin)
- [ ] Upload button appears when appropriate
- [ ] Rate limit errors handled gracefully
- [ ] Network errors handled
- [ ] Settings from Firestore work
- [ ] Settings from env vars work
- [ ] Model selection works

### Code Style

**Follow existing patterns**:
- TypeScript strict mode
- Async/await (not promises)
- Error handling with try/catch
- Console logging for debugging
- User-friendly error messages

**File Organization**:
- Components in `src/components/shared/`
- API routes in `src/app/api/`
- Utilities in `src/lib/`
- Types in `src/types/`

### Performance Considerations

**Current Optimizations**:
- Receipt history only fetched when needed
- Messages stored in component state (not persisted)
- API calls debounced (user can't spam)

**Future Optimizations**:
- Cache receipt history
- Debounce API calls
- Lazy load chatbot component
- Memoize expensive computations

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/components/shared/chatbot.tsx` | Main chatbot UI component |
| `src/app/api/ai-assistant/route.ts` | API endpoint for AI requests |
| `src/ai/flows/assistant-flow.ts` | Client-side API wrapper |
| `src/lib/firebase-ai-settings-store.ts` | AI settings management |
| `src/components/shared/modern-sidebar.tsx` | Sidebar integration |

### Environment Variables

```env
GOOGLE_AI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash  # Optional
```

### Firestore Path

```
platform_settings/ai_settings
```

### API Endpoint

```
POST /api/ai-assistant
```

### Common Commands

```bash
# Test API directly
curl -X POST http://localhost:9003/api/ai-assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# Check environment variables
echo $GOOGLE_AI_API_KEY
```

---

## Support & Resources

### Documentation Files

- `TECHNICAL_DOCUMENTATION.md`: Overall system documentation
- `GEMINI_RATE_LIMIT_SOLUTIONS.md`: Rate limit troubleshooting
- `FIREBASE_SETUP.md`: Firebase configuration

### External Resources

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Google AI Studio](https://makersuite.google.com/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### Getting Help

1. Check this documentation
2. Review error messages in console
3. Check `GEMINI_RATE_LIMIT_SOLUTIONS.md` for rate limit issues
4. Review code comments in source files
5. Check Firebase Console for settings

---

## Conclusion

This documentation provides a comprehensive guide to the ReceiptShield Chatbot system. The next team should be able to:

- Understand how the chatbot works
- Modify and extend functionality
- Troubleshoot common issues
- Add new features
- Maintain and improve the system

For questions or clarifications, refer to the code comments in the source files or the technical documentation.

**Last Updated**: [Current Date]  
**Version**: 1.0  
**Maintained By**: ReceiptShield Development Team

