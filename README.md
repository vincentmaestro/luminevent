# Luminevent Backend

## Overview

Luminevent is a comprehensive event management platform designed to facilitate seamless planning, organization, and execution of events. This repository hosts the backend service, which serves as the central nervous system for the entire platform.

The Luminevent Backend is a robust RESTful API server responsible for:

- Managing core business logic for event lifecycle.
- Handling user authentication and authorization.
- Processing ticket sales and payments securely.
- Facilitating communication with event attendees.
- Providing analytics and reporting capabilities.
- Integrating with various third-party services for enhanced functionality.

---

## Technical Specifications

This backend is built upon a modern, scalable technology stack:

- **Language:** TypeScript (ES6+)
- **Runtime:** Node.js (v18.x or later)
- **Framework:** Express.js (v4.x or later)
- **Database:** MongoDB (v6.x or later) with Mongoose ODM
- **Caching:** Redis
- **Authentication:** JWT-based token authentication
- **Payment Gateways:** Paystack / Flutterwave API integration
- **Notification Services:**
    - Email: SendGrid
    - SMS: Twilio
    - Real-time: WebSocket (for immediate alerts and updates)
- **API Design:** RESTful API utilizing JSON payloads, documented via HopScotch/Postman/ThunderClient collections.
- **File Generation:**
    - PDF: PDFKit or Puppeteer
    - Excel: exceljs
- **Scheduling:** `node-cron` for recurring tasks and reports.
- **Cloud Storage (Optional):** AWS S3 / Cloudinary for media uploads.
- **Environment Management:** `dotenv`
- **Package Manager:** NPM

---

## Architecture

The Luminevent Backend employs a **microservices-oriented architecture** to ensure scalability, fault tolerance, and modularity. Key components include:

- **API Gateway:** Serves as the single entry point, routing requests to appropriate services, enforcing rate limiting, and managing initial authentication.
- **User Service:** Manages user registration, login (JWT, OAuth 2.0), profiles, and role-based access control (Admin, Organizer, Attendee).
- **Event Service:** Handles all event-related operations, including CRUD operations for events, categories, and integration with cloud storage for media uploads.
- **Payment Service:** Dedicated to processing transactions, integrating with payment gateways (Paystack/Flutterwave), managing refunds, and handling webhooks.
- **Notification Service:** Responsible for dispatching various alerts via email (SendGrid), SMS (Twilio), and real-time WebSocket communication.
- **Analytics Service:** Aggregates and processes data for reporting and insights, leveraging MongoDB for data storage and Redis for caching frequently accessed data for dashboards.

---

## Functional Scope & Capabilities

The backend's capabilities are divided into several core modules:

### User Management

- **Authentication & Authorization:** User registration, login (email/password, social login via Google OAuth), JWT-based token management, and Role-Based Access Control (RBAC) supporting Admin, Organizer, and Attendee roles.
- **Profile Management:** Users can update their profiles.
- **Account Lifecycle:** Soft deletion of accounts with data retention options (e.g., 30 days before permanent termination).
- **Account Security:** Password reset, email verification, and auto-generated user IDs.

### Event Management

- **Event Lifecycle:** Organizers can create, update, and delete events, including setting details like title, description, date, time, location, categories, and visibility (public/private).
- **Media Management:** Support for uploading event images and videos (via AWS S3 / Cloudinary).
- **Scheduling:** Event scheduling and potential integration with external calendars.
- **Event Discovery:** Attendees can view and register for available events (free or paid).

### Ticketing & Payments

- **Ticket Configuration:** Organizers can define ticket types (e.g., VIP, General), prices, and quantities.
- **Secure Transactions:** Integration with Paystack/Flutterwave for secure payment processing.
- **Order Fulfillment:** Comprehensive order management, including webhook handling for payment success/failure.
- **Refunds:** Automated refund processing for event cancellations.
- **Receipts:** Automatic email receipts and downloadable PDF receipts upon successful payment or refund.
- **Sales & Inventory:** Real-time tracking of tickets sold vs. available, with dynamic availability management.

### Communication & Notifications

- **Automated Alerts:** Email and SMS notifications for registration confirmation, payment success/refund, and critical event updates/cancellations.
- **Real-time Updates:** WebSocket integration for immediate event updates and alerts to attendees.

### Analytics & Reporting (Admin Panel)

- **Comprehensive Reporting:** Generation of reports covering total revenue, event-wise sales, refunds issued, and user activity.
- **Flexible Filtering:** Reports can be filtered by date range, specific events, or organizers.
- **Export Options:** Reports are downloadable in Excel (XLSX) and PDF formats.
- **Scheduled Delivery:** Ability to schedule reports for daily, weekly, or monthly delivery via email.
- **Historical Data:** Storage and viewing of past generated reports.
- **Access Control:** Permission system to restrict access to sensitive reports and modules for administrators.

### Admin Controls

- **User Management:** Admins have full CRUD (Create, Read, Update, Delete) capabilities over user accounts.
- **Event Oversight:** Ability to view and manage all events across the platform.
- **System Access:** Centralized access to analytics, reports, and granular permissions for granting/revoking access to various modules.

---

## API Endpoints

The API is structured with dedicated route groups for clear separation of concerns and role-based access:

- `/api/admin/` - Admin-specific operations.
- `/api/users/` - General user profile and account operations.
- `/api/organizers/` - Endpoints for event organizers.
- `/api/attendees/` - Endpoints for event attendees.

Common endpoints accessible across multiple roles or for general functionality:

- `/api/auth/`
- `/api/events/`
- `/api/payments/`
- `/api/reports/`
- `/api/notifications/`

Comprehensive API specifications and examples are available via the HopScotch/Postman/ThunderClient collections.

---

## Non-Functional Requirements

The backend is designed with a strong focus on reliability, performance, and security:

- **Scalability & Performance:**
    - API Latency: Target response times of \<200ms for 99% of requests.
    - Throughput: Designed to support 10,000+ concurrent users, rigorously tested via tools like JMeter.
    - Horizontal scaling capabilities to handle increased traffic.
    - Load balancing for efficient traffic distribution.
    - Caching with Redis for frequently accessed data, especially for reports.
    - Optimized data retrieval through pagination for large listings.
    - Asynchronous dispatch for emails and SMS to prevent blocking.
    - Modular services and controllers for a clean, maintainable architecture.
- **Security:**
    - Role-based authentication and authorization middleware using JWT.
    - Data encryption at rest (AES-256) and in transit (TLS 1.3) to ensure PCI-DSS compliance for payment data.
    - Regular security audits and penetration testing to maintain OWASP Top 10 compliance.
    - HTTPS-only communication enforcement.
    - Robust password hashing using bcrypt.
    - Rate limiting on critical endpoints to prevent abuse.
    - Comprehensive input validation and sanitization (e.g., using Joi or express-validator).
- **Availability:**
    - Target uptime Service Level Agreement (SLA) of 99.9%.
- **Logging & Monitoring:**
    - Centralized logging with tools like Winston, Morgan, or an ELK Stack.
    - Integration with monitoring tools such as Sentry or LogRocket for error tracking and performance insights.

---

## Local Development Setup with Docker

To get the Luminevent Backend running on your local machine:

1. **Clone the Repository:**

    ```sh
    git clone <repository-url>
    cd Luminevent-Backend
    ```

2. **Configure Environment:**
    - Ensure you have a `.env` file in the root directory with all necessary environment variables (e.g., database connection strings, API keys). Refer to `.env.example` for required variables.

3. **Run in Development Mode:**
    - Build the development Docker image:

        ```sh
        docker-compose -f docker-compose.yml up --build -d
        ```

    - Stop the container:

        ```sh
        docker-compose -f docker-compose.yml down
        ```

    - The backend API will be accessible at `http://localhost:5000`. This setup typically includes hot-reloading and debugging capabilities, as defined in `docker-compose.yml`.

4. **Drizzle Database Commands**
    - To migrate the database changes after making any adjustment to it, use the script below:

    ```bash
    pnpm push
    ```

    - To view what the database looks like, run the script below:

    ```bash
    pnpm studio
    ```

    Then access the dashboard on ["this link"](https://local.drizzle.studio)

---

## Deployment to Production (e.g., Render)

For deploying the Luminevent Backend to a production environment like Render:

1. **Clone the Repository:**

    ```sh
    git clone <repository-url>
    cd Luminevent-Backend
    ```

2. **Build the Production Docker Image (Optional for local testing):**

    ```sh
    docker build -f Dockerfile -t luminevent-backend-prod .
    ```

    - You can run this container locally with `docker run -d -p 5000:5000 --env-file .env luminevent-backend-prod` to test the production build.

3. **Deploy to Render:**
    - Push your code to your chosen Git repository.
    - On the Render dashboard, create a new Web Service.
    - Connect your repository.
    - **Build Command:** Render will automatically detect your `Dockerfile`. If you have a specific `Dockerfile` for production (e.g., `Dockerfile`), ensure it's named as such. Render typically builds the `Dockerfile` in the root.
    - **Start Command:**

        ```sh
        node build/index.js # Or the command that starts your compiled app, if not directly docker entrypoint
        # Alternatively, if your Dockerfile defines CMD, Render might pick it up.
        ```

        **Note:** For Docker-based deployments on Render, you typically just point to your `Dockerfile`, and Render handles the build and run based on your `EXPOSE` instruction and `CMD` in the `Dockerfile`. You would primarily configure environment variables in the Render dashboard, not via `--env-file`. Ensure your application listens on `process.env.PORT` which Render provides.

---

## Contributors

[See all contributors](/CONTRIBUTORS.md)

---

For further details on specific modules, API endpoints, or contribution guidelines, please refer to the project's [documentation]("") or contact the development team.