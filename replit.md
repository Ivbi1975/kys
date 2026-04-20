# Overview

This pnpm workspace monorepo, built with TypeScript, provides a comprehensive solution for managing Kurban Bayramı share certificates. The project aims to streamline the process of organizing donations, assigning them to animal groups, and tracking their status.

Key capabilities include:
- Efficient management of cutting areas and donor information, with flexible import options.
- Intelligent grouping of donors into animal shares (groups of 7).
- Robust tracking and reporting features, including public tracking links and detailed reports.
- Advanced conflict resolution and automation tools for donation management.
- Scalable architecture designed to handle large volumes of data and users.

The business vision is to become the leading platform for Kurban Bayramı organization, offering an intuitive, reliable, and feature-rich experience for charities and individuals alike.

# User Preferences

I prefer concise and accurate information.
I like a clear separation of concerns in the codebase.
I prefer detailed explanations for complex logic.
I want iterative development with frequent, small updates.
Ask before making major architectural changes.
Do not make changes to the `lib/api-spec` directory directly; changes should be made to the OpenAPI spec, and then codegen should be run.
Do not make changes to generated files in `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/`.
Ensure all database migrations are explicitly reviewed before applying to production.
For frontend development, prioritize user experience and performance.
For backend development, prioritize security, scalability, and maintainability.

# System Architecture

The project is structured as a pnpm workspace monorepo, separating deployable applications (`artifacts`) from shared libraries (`lib`) and utility scripts (`scripts`).

## UI/UX Decisions

The frontend application, "Kurban Hisse Kağıdı," is a React + Vite app with a focus on usability and responsiveness.
- **Theme Support**: Includes light, dark, and system-aware themes.
- **Workspace Layout**: Flexible, multi-column grid layout with customizable visibility, order, and resizing, with preferences persisted locally.
- **Mobile Responsiveness**: Adapts to mobile devices with tab-based navigation and compact elements.
- **Interaction Patterns**: Utilizes toast notifications for feedback, AlertDialogs for destructive actions, and an undo/redo system for data manipulation.

## Technical Implementations

- **Monorepo**: pnpm workspaces for managing multiple packages.
- **Language**: TypeScript 5.9 for type safety across the entire project.
- **API Framework**: Express 5 for building the RESTful API.
- **Database & ORM**: PostgreSQL with Drizzle ORM for data persistence.
- **Validation**: Zod for robust schema validation, including `drizzle-zod` for database schema validation.
- **API Codegen**: Orval generates API clients and Zod schemas from an OpenAPI spec.
- **Build System**: esbuild for efficient CJS bundling.
- **Authentication**: API key middleware (`X-API-Key`) and HMAC-signed session tokens for photo endpoints.
- **Rate Limiting**: Implemented globally and for specific tracking endpoints.
- **Error Handling**: Centralized `asyncHandler` and `errorHandler` middleware for consistent error responses, redacting sensitive information in production.
- **Data Models**: Key entities include `Donation` (with attributes like name, share count, status, tags), `AnimalGroup` (containing donations, status, and tracking info), `KesimAlani` (cutting areas), and `Project`.
- **Offline Mode**: The tracking page supports offline functionality using Service Worker and IndexedDB for caching and syncing changes.
- **Audit Logging**: Comprehensive audit trail for critical actions, with automated purging.
- **Automation Rules**: User-defined rules with conditions and actions for managing donations.

## Feature Specifications

### Kurban Hisse Kağıdı (Frontend)
- **Donor Management**: Manual entry, Excel/CSV import with column mapping, multi-select bulk operations (delete, edit, transfer).
- **Grouping Logic**: Smart auto-grouping algorithm (bin-packing) to form animal groups of 7 shares, with drag-and-drop support.
- **Conflict Resolution**: Automated and manual tools for resolving donation conflicts.
- **Donation Tracking**: Manual flagging, "Sorunlu Bağışlar" page for centralized conflict viewing, public tracking links.
- **Reporting & Export**: Client-side Excel export, server-side streaming Excel export for large datasets, PDF export for print.
- **Statistics Dashboard**: Provides real-time insights into kesim details, share distribution, and group composition.
- **Undo/Redo System**: Snapshot-based history for user actions.
- **Cross-Kesim-Alanı Basket**: Allows transferring donors between different cutting areas within a project.
- **Custom Tag System**: User-defined tags for categorizing donations.
- **Advanced Filtering**: Comprehensive filtering options for donor lists.
- **Soft Deletion**: Implemented for kesim alanları and donations with trash/restore functionality.
- **Bagis Havuzu (Donation Pool)**: Centralized management of all donations within a project, featuring advanced filtering, bulk operations, AI classification, and automation rules.

### API Server (Backend)
- **Routes**: Comprehensive API endpoints for managing projects, kesim alanları, donations, animal groups, tags, settings, backup/restore, and AI services.
- **Services**: Business logic organized into dedicated services (e.g., `kesim-alani.service.ts`, `conflict.service.ts`, `rule-engine.service.ts`).
- **Performance Optimizations**: In-memory caching, compact response formats, Brotli/gzip compression, streaming Excel exports.
- **AI Integration**: OpenAI integration for AI-based classification of donation notes.
- **Automation Rules Engine**: Evaluates user-defined rules based on donation attributes and executes specified actions.

# External Dependencies

- **Node.js**: Runtime environment (version 24).
- **pnpm**: Package manager.
- **TypeScript**: Programming language.
- **Express**: Web application framework.
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Zod**: Schema declaration and validation library.
- **Orval**: OpenAPI code generator.
- **esbuild**: JavaScript bundler.
- **pino**: Logger.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **ExcelJS**: Library for reading, writing, and styling Excel files.
- **OpenAI**: AI services for classification.
- **vite-plugin-pwa**: Vite plugin for PWA features (Service Worker, IndexedDB).