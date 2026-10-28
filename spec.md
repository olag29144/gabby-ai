# PROJECT SPECIFICATION — GEMINI-INSPIRED AI ASSISTANT WEB APPLICATION

## 1. PROJECT OBJECTIVE

Act as a senior full-stack engineer, UI/UX designer, frontend architect, AI integration specialist, and QA engineer.

Build a complete, polished, production-minded AI assistant web application inspired by the user experience, layout, interaction patterns, responsiveness, and functionality of Google's Gemini web application.

Reference website:
https://gemini.google.com/

Official product reference:
https://gemini.google/about/

The goal is to recreate the overall quality and familiar interaction patterns of a modern Gemini-style AI assistant as closely as reasonably possible, while using an original product identity, original logo, and original implementation.

Do not build a static mockup. Build a working application.

Project name: Nova AI (working name; keep it easy to rename).

Primary requirements:
- Closely study the reference website's available interface.
- Inspect its sidebar, home screen, composer, buttons, dropdowns, chat layout, message formatting, settings, and responsive behavior.
- Use reference screenshots when available.
- Reproduce the overall visual proportions, spacing, typography hierarchy, alignment, interaction patterns, and visual polish.
- Do not copy Google's proprietary logo, proprietary assets, or claim this application is an official Google product.
- Do not stop after building the landing screen.
- Implement the complete application in the existing project directory.
- Preserve any existing working code and project configuration unless a change is necessary.

## 2. DEVELOPMENT WORKFLOW

Before writing code:

1. Inspect the entire existing project.
2. Identify the framework, dependencies, routing, components, API integrations, and current functionality.
3. Read existing configuration files and environment variable examples.
4. Determine which features already work and which need to be implemented.
5. Inspect the reference website in a browser if browsing is available.
6. Create a feature checklist and implementation plan.

Then build the application in logical stages.

Do not ask me to manually create every component or file. Make the changes directly in the project.

If browser access to the reference website is blocked, use accessible official documentation and reference screenshots supplied by me. Do not invent claims about having inspected inaccessible pages.

After implementation:
- Run the application.
- Run the available build, lint, and type-check commands.
- Fix errors.
- Test important interactions.
- Inspect the UI at desktop, tablet, and mobile widths.
- Report any feature that remains incomplete or requires an API key.

## 3. TECHNOLOGY STACK

Use the existing project stack where practical.

For a new project, prefer:

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React for interface icons
- React Router where routing is needed
- A reliable Markdown renderer
- Syntax highlighting for code responses

Backend:
- Node.js
- TypeScript
- Express or an appropriate existing server framework

AI:
- A provider abstraction supporting Google's Gemini API.
- Use the official Google GenAI SDK and current official documentation.
- Keep model identifiers configurable.
- Support streaming responses when the chosen model and SDK support it.

Persistence:
- PostgreSQL with Supabase for a multi-user production application, or
- IndexedDB/localStorage for a clearly identified local-only prototype.

Use stable, compatible dependency versions. Do not replace working project architecture unnecessarily.

## 4. VISUAL DESIGN AND REFERENCE MATCHING

The reference interface must guide the visual implementation.

Study and reproduce the following characteristics as closely as possible:

- A spacious, clean AI workspace.
- A collapsible left navigation sidebar.
- A large central conversation area.
- A prominent welcome heading on the new-chat screen.
- A floating or bottom-anchored message composer matching the reference layout.
- Rounded controls and restrained borders.
- Appropriate light and dark themes.
- A clear typographic hierarchy.
- Carefully aligned icons and labels.
- Subtle transitions and responsive layout behavior.
- Consistent spacing throughout the application.

Do not substitute a generic SaaS dashboard design.

Do not use an unrelated gradient-heavy landing page, oversized marketing sections, glassmorphism, excessive shadows, or unnecessary decorative cards.

Use CSS variables or design tokens for colors, typography, radii, spacing, borders, and elevation.

Create a coherent original brand identity rather than copying the Gemini logo or proprietary branded artwork.

The interface should feel like a carefully implemented AI chat product, not a template.

### Layout requirements

Desktop:
- Sidebar on the left.
- Main workspace taking the remaining width.
- Header controls positioned consistently.
- Conversation content centered within a readable maximum width.
- Composer anchored near the bottom of the conversation workspace.
- Correct scrolling behavior without nested-scroll bugs.

Tablet:
- Sidebar collapses or becomes an overlay.
- Main content remains readable.
- Composer controls adapt to the reduced width.

Mobile:
- Compact top navigation.
- Sidebar accessible through a menu button.
- Full-width conversation area.
- Composer fits narrow screens.
- Upload menus and dropdowns remain usable.
- No horizontal overflow.

## 5. BRANDING AND LOGO

Create an original product identity named Nova AI.

Design an original, recognizable AI symbol using SVG or CSS.

Logo requirements:
- Clean geometric form.
- Suitable for a modern AI assistant.
- Attractive at small sizes.
- Consistent in the sidebar, app header, favicon, and loading states.
- Works on light and dark backgrounds.
- Include a wordmark where appropriate.
- Do not download or reuse Google's Gemini logo as if it were our own.

Create:
- An original SVG logo.
- A favicon.
- An application title and metadata.
- Consistent icon sizing.
- Accessible labels for icon-only buttons.

The logo must be a real asset in the project, not an emoji placeholder.

## 6. APPLICATION HOME SCREEN

Build a complete new-conversation screen.

Include:
- Original product identity.
- A welcoming heading with appropriate visual hierarchy.
- A large message composer.
- A plus/add-attachment control.
- A model selector where supported.
- A send button.
- Relevant tool controls.
- A small number of helpful prompt suggestions.

Example prompt suggestions:
- Help me understand a difficult concept.
- Write and improve my code.
- Summarize a document.
- Brainstorm creative ideas.

Suggestion cards must be interactive. Selecting one should populate the composer or begin the corresponding action.

The home screen must adapt to available screen space and must not resemble a static marketing page.

## 7. SIDEBAR AND NAVIGATION

Implement a fully functional sidebar containing:

- New chat.
- Recent conversations.
- Search conversations.
- Pinned conversations, if implemented.
- Conversation history.
- Settings.
- Help and feedback.
- User account controls where authentication exists.

Requirements:
- Sidebar collapse and expand.
- Overlay behavior on small screens.
- Active conversation highlighting.
- Hover and focus states.
- New conversation action.
- Conversation titles generated from the initial user prompt.
- Persistent conversation history.
- Rename conversation.
- Delete conversation with confirmation.
- Pin and unpin conversations if supported.
- Search existing conversation titles and content.
- Empty state when no conversations exist.

Do not fill the sidebar with fabricated conversations in production mode. Sample conversations may be used in an explicitly labeled development demo.

## 8. CHAT EXPERIENCE

This is the most important part of the application.

Implement a functional AI chat interface.

Required behavior:
- User can type and send a message.
- Enter sends a message.
- Shift+Enter inserts a newline.
- Send button submits the message.
- Empty messages cannot be submitted.
- The user message appears immediately.
- The assistant response streams progressively where supported.
- A stop-generation button interrupts an active response where supported.
- A regenerate-response action retries the last assistant response.
- Conversation context is preserved across messages.
- The chat scrolls naturally to the latest content.
- Older messages remain accessible.
- Loading, error, retry, and empty states are implemented.
- Failed requests do not silently erase user input.
- The user can copy a message.
- The user can provide thumbs-up or thumbs-down feedback.
- The interface distinguishes user messages from assistant messages.
- The interface does not display fake model reasoning as authentic internal reasoning.

Assistant responses must support:
- Paragraphs.
- Headings.
- Ordered and unordered lists.
- Bold and italic text.
- Tables.
- Blockquotes.
- Fenced code blocks.
- Inline code.
- Links.
- Appropriate spacing between response sections.

Code blocks must include:
- Syntax highlighting.
- A copy button.
- Horizontal scrolling for long lines.
- Clear language identification when available.

Use a secure Markdown rendering strategy. Sanitize untrusted HTML and do not execute arbitrary HTML returned by a model.

## 9. MESSAGE COMPOSER

Build a polished, responsive composer.

Include:
- Multiline text input.
- Send button.
- Stop-generation button during generation.
- Attachment button.
- Keyboard shortcuts.
- Disabled and loading states.
- Correct resizing behavior.
- Accessible focus indicators.

The composer must remain usable when the conversation contains long messages.

Composer actions must be real. Do not create decorative controls that do nothing.

## 10. FILE AND IMAGE UPLOADS

Implement a working attachment system.

Support appropriate file types based on the chosen AI provider and configured application limits.

Include:
- Image upload.
- PDF upload.
- Text document upload.
- Supported office documents where practical.
- File name and size display.
- File previews where appropriate.
- Remove attachment action.
- Upload progress.
- File validation.
- Clear error messages.

When an uploaded file is sent to the AI, include the actual file content or a valid provider-supported file reference.

Do not claim to analyze a file when only its filename was sent.

Enforce file size and type limits on both client and server.

Do not expose uploaded private documents publicly.

## 11. AI PROVIDER INTEGRATION

Connect the application to a real AI provider.

Primary integration: Google Gemini API using the official Google GenAI SDK.

Requirements:
- Create a server-side AI service.
- Keep the model identifier configurable.
- Support streaming when available.
- Maintain relevant conversation context.
- Handle provider errors and rate limits.
- Handle invalid or missing API keys.
- Handle timeouts and interrupted connections.
- Validate incoming requests.
- Avoid sending unnecessary conversation history.
- Display friendly errors without exposing secrets.
- Allow future providers to be added through a common interface.

Create a provider abstraction so that the UI does not depend directly on one provider's API format.

Example environment variables:

GEMINI_API_KEY=
GEMINI_MODEL=
DATABASE_URL=
SESSION_SECRET=

Create a `.env.example` file containing placeholders only.

Never hardcode API keys in frontend source code, public configuration, Git history, or committed environment files.

Never ask the user to paste an API key into a public chat message.

Use server-side environment variables. Ensure API requests pass through the backend.

Use official, current API documentation to determine valid model names and supported features.

Do not pretend that an API call succeeded if the provider is unavailable.

## 12. MODEL SELECTOR

Implement a model selection dropdown.

Requirements:
- Show the currently selected model.
- Allow switching between configured models.
- Display model descriptions only when accurate.
- Persist the user's preferred selection.
- Use actual model IDs supported by the configured provider.
- Handle unavailable models gracefully.
- Do not advertise premium models or capabilities that the API key cannot access.

The UI must distinguish a visual selector from actual model switching. Selecting a model must change the backend request.

Do not invent access to proprietary Gemini application subscriptions through a standard API key.

## 13. WEB SEARCH AND SOURCES

Create a web-search capability where supported.

Use a supported search integration, such as an appropriate official provider search tool or a separately configured search API.

Requirements:
- Search must be explicitly available in the UI.
- Send the correct search-enabled request to the backend.
- Display source links and citations when returned by the integration.
- Make citations clickable.
- Distinguish cited information from ordinary generated text.
- Display a clear error when search is unavailable.
- Do not fabricate sources, URLs, citations, or claims of live browsing.

Do not implement web search by merely instructing the language model to pretend it has internet access.

## 14. IMAGE GENERATION

Provide an image-generation tool if the configured provider or a separate image-generation service supports it.

Requirements:
- Dedicated image-generation action.
- Prompt input.
- Loading state.
- Display generated images.
- Allow downloading generated results where permitted.
- Show errors when the provider fails.
- Support relevant image inputs if the provider supports editing or reference images.
- Keep generation parameters configurable.
- Do not display a fake generated image as a real API result.

Use a provider adapter so image generation can be added without rewriting the chat interface.

Clearly distinguish image understanding from image generation.

## 15. VOICE FEATURES

Implement voice features where the necessary browser and backend capabilities exist.

Potential functionality:
- Microphone input.
- Speech-to-text.
- Text-to-speech.
- Playback controls.
- Voice conversation mode where a suitable real-time service is configured.

Use browser speech APIs or a real speech service when appropriate.

Request microphone permissions only after a user action.

Show permission errors clearly.

Do not simulate a live conversation by merely animating a microphone icon.

## 16. CHAT HISTORY AND PERSISTENCE

Persist:
- Conversations.
- Messages.
- Conversation titles.
- Selected model.
- Creation and update timestamps.
- User preferences.
- Pinned conversations, if implemented.

For local-only mode, use IndexedDB or another appropriate browser storage solution.

For multi-user mode, use authenticated server-side persistence.

Requirements:
- Reloading the page must not erase saved conversations.
- Switching conversations must restore their messages.
- Renaming and deleting conversations must update persistent storage.
- User data must be separated by authenticated account.
- Do not store secrets in localStorage.
- Provide a way to clear local conversation history.
- Handle storage errors gracefully.

Do not claim that localStorage alone provides secure, multi-device account synchronization.

## 17. AUTHENTICATION

If account functionality is included, implement actual authentication using a suitable provider or a secure session-based system.

Include:
- Sign up.
- Sign in.
- Sign out.
- Session persistence.
- Protected conversation history.
- Account menu.
- User-friendly authentication errors.

Do not build a fake Google sign-in page or collect Google passwords.

Use an approved authentication flow if Google sign-in is required.

If authentication is not configured, provide a clearly identified local guest mode.

## 18. SETTINGS

Build a functional settings interface.

Include:
- Light theme.
- Dark theme.
- System theme.
- Appearance preferences.
- Default model selection.
- Conversation history controls.
- Data and privacy information.
- Keyboard shortcut information.
- Clear history.
- Application information.
- Feedback entry point.

Persist preferences appropriately.

Use accessible dialogs or panels with keyboard support and focus management.

## 19. INTERACTIONS AND ANIMATIONS

Use restrained, polished animation.

Include:
- Sidebar open and close transitions.
- Dropdown animations.
- Button hover and press feedback.
- Subtle message appearance.
- Loading indicators.
- Streaming response updates.
- Attachment preview transitions.
- Smooth scrolling when appropriate.

Requirements:
- Keep transitions fast and purposeful.
- Respect `prefers-reduced-motion`.
- Avoid excessive bouncing, parallax, and distracting effects.
- Never delay essential content until an animation finishes.
- Avoid unnecessary animation on every scroll event.

## 20. ACCESSIBILITY

Implement:
- Semantic HTML.
- Keyboard navigation.
- Visible focus states.
- Appropriate ARIA labels.
- Accessible dialogs.
- Sufficient color contrast.
- Screen-reader-friendly loading states.
- Accessible file inputs.
- Reduced-motion support.
- Correct heading hierarchy.

Every interactive icon must have an accessible name.

## 21. SECURITY AND PRIVACY

Implement:
- Server-side API key handling.
- Request validation.
- Authentication checks for private data.
- Rate limiting where appropriate.
- Safe Markdown rendering.
- Secure file validation.
- Sensible file size limits.
- Protection against unauthorized conversation access.
- Safe error messages.
- Appropriate CORS configuration.
- No secrets in client bundles.
- No hardcoded credentials.
- No collection of Google passwords.
- No unauthorized scraping of private or restricted resources.

Never use browser automation to access another service's private account or bypass its protections.

## 22. PROJECT STRUCTURE

Use a clean, maintainable architecture appropriate to the selected stack.

Separate:
- UI components.
- Pages.
- Layout.
- Sidebar.
- Conversation components.
- Composer.
- Attachments.
- Settings.
- AI provider services.
- Backend routes.
- Database access.
- Authentication.
- Validation.
- Shared types.
- Utilities.
- Assets.
- Tests.

Keep components reusable and reasonably small.

Do not place the entire application in one enormous component.

Do not add unnecessary dependencies.

Do not add code comments unless required for an unusually complex implementation or essential documentation.

## 23. TESTING

Test the following workflows:

1. Open the application.
2. Start a new conversation.
3. Send a message.
4. Receive a real AI response.
5. Send a follow-up message.
6. Stop generation where supported.
7. Retry a failed response.
8. Copy an assistant response.
9. Create a second conversation.
10. Switch between conversations.
11. Rename a conversation.
12. Delete a conversation.
13. Search conversation history.
14. Upload an image.
15. Upload a supported document.
16. Switch the selected model.
17. Change the theme.
18. Refresh the browser and restore history.
19. Open and close the sidebar on mobile.
20. Verify the application works at narrow viewport widths.
21. Test missing API key behavior.
22. Test provider errors.
23. Verify that no API key is exposed in browser code.
24. Run the production build.

Fix all errors discovered during testing.

## 24. ACCEPTANCE CRITERIA

The project is not complete until:

- The application runs locally.
- The visual layout has been compared against the available reference.
- The home screen and chat workspace are polished.
- The sidebar works.
- The composer works.
- Real AI requests succeed with valid configuration.
- Streaming works when supported.
- Chat history persists according to the selected storage architecture.
- Available attachment workflows work.
- Settings are functional.
- The interface is responsive.
- Errors are handled gracefully.
- The project builds successfully.
- No core feature is represented solely by a decorative button.
- No fake AI responses are presented as real provider output.
- API keys remain private.
- Any unfinished integrations are clearly documented.

## 25. FINAL INSTRUCTIONS

Build the complete application directly in the existing workspace.

Prioritize visual fidelity, interaction quality, real AI functionality, and clean architecture.

Do not stop after producing a plan.

Do not leave the main interface as a static mockup.

Do not replace real functionality with alerts, placeholder buttons, hardcoded responses, or fake loading animations.

Use available official documentation to verify integration details.

After building, provide:
1. A summary of the implemented features.
2. The final project structure.
3. Setup and run instructions.
4. Required environment variables.
5. Features that require paid services or API keys.
6. Build and test results.
7. Any known limitations.

Start by inspecting the existing project, then implement, run, and verify the application.