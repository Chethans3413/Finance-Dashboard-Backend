# Finance-Dashboard-Backend

---

# Finance Dashboard: Architecture & Implementation Details

This README outlines the development, design, and internal engineering principles of the Finance Dashboard application. It is structured to address eight core pillars of the project.

---

### Core Design Philosophy & Assumptions
- **Correctness, Clarity, and Maintainability:** The architecture prioritizes straightforward data flow. APIs are structured logically and backend logic is written to ensure long-term stability and ease of onboarding.
- **Reasonable Assumptions:** Where requirements were left open, sensible choices were made and documented (e.g., eager read-model recalculation, standard RBAC tiering).
- **Clean Implementation:** "A smaller but well-designed solution is better than a large but inconsistent one." This principle drove our choice of a targeted CQRS approach and a systematic, strictly typed Vercel Serverless implementation over a dense monolith.

---

### 1. Backend Design
The application utilizes a **CQRS (Command Query Responsibility Segregation)** pattern backed by **Vercel Serverless Functions** and **Supabase (PostgreSQL)**. 
- **Routes:** The backend is logically separated into distinct domains via `/api/records`, `/api/dashboard`, `/api/users`, and `/api/readmodel_refresh`.
- **Separation of Concerns:** The core transactional database is strictly isolated from read queries. Writes occur in normalized `core_*` tables, while complex dashboard aggregates (Total Income, Trends, Category Breakdown) are decoupled and served instantly by querying pre-computed `read_*` materializations.
- **Services:** Authentication is seamlessly tied to Supabase Auth, extracting user roles directly from secure JWTs in the stateless API layer.

### 2. Logical Thinking
- **Business Rules & Access Control:** We implement strict server-side **Role-Based Access Control (RBAC)**. Roles like `viewer`, `analyst`, and `admin` control logic execution at the API layer, determining who can write records, view global read models, or manage user roles.
- **Data Processing:** To prevent the primary transactional DB from locking up under analytical workloads, we execute a read-model refresh trigger that safely re-batches dashboard aggregates asynchronously or on-demand without hanging user transactions.
- **Intelligent Client Logic:** Implemented an amount-aware smart category suggestion algorithm on the frontend that predicts transaction categories based on financial thresholds (e.g., automatically suggesting "Salary" for income > ₹50,000 with high confidence).

### 3. Functionality
- **API Consistency:** The APIs provide reliable CRUD operations. The dashboard flawlessly displays interactive SVG sparklines, donut charts, and bar graphs visualizing trends and aggregated financial contexts correctly.
- **Robust Dev-Mode Fallback:** In the absence of an integrated backend, the application features a robust "Bypass Auth (Dev Mode)" fallback using a deterministic mock data layer that entirely simulates the API. It allows the UI to render charts and accept interactions completely offline.
- **UI Aesthetic:** The entire application reflects an "Aigentic" neo-minimalist light mode design template, strictly matching premium visual standards with crisp `.glass-card` elements, vibrant lime green accents, and cohesive high-contrast typography.

### 4. Code Quality
- **Maintainability:** Code is heavily componentized (`StatCard`, `DonutChart`, `BarChart`, `AuthGate`), creating reusable UI building blocks. 
- **Readability & Typing:** Strongly-typed TypeScript interfaces (`DbRecord`, `RoleRow`, `TrendItem`) enforce data integrity throughout the components and API boundaries. 
- **Efficient React Practices:** The codebase effectively utilizes functional hooks (`useMemo`, `useState`, `useEffect`) to calculate view models and complex visual scales locally without unnecessary DOM re-renders.
- **Styling Consistency:** TailwindCSS is utilized systematically with overarching design tokens to eliminate magic numbers and ensure design coherence. 

### 5. Database and Data Modeling
- **Relational Integrity:** Managed through PostgreSQL (via Supabase), data is modeled using exact constraints and strict column types.
- **CQRS Schemas:** 
  - `core_user_roles`: Manages application permissions.
  - `core_financial_records`: An append-heavy transaction ledger for income and expense capturing (acting as the system of record).
  - `read_dashboard_summaries`, `read_category_totals`, `read_trends_monthly`: Read-optimized flattening tables that serve instant dashboard analytics without requiring active joins.

### 6. Validation and Reliability
- **Bad Input Handling:** API layer payloads are sanitized and validated against required data structures. Frontend forms enforce numeric limits, localized string parsing (`type="date"`, `type="number"`), and dynamic validation states.
- **Graceful Error States:** Error boundary checks and intuitive toast notifications (e.g., success and error banners in the Admin dashboard) inform users of processing states. 
- **Resiliency:** The data visualization components automatically handle null structures, falling back to "No data to display" empty states rather than causing a JavaScript panic when metrics are zeroed out.

### 7. Documentation
- **Clear Tradeoffs:** This documentation clarifies *why* CQRS is utilized—prioritizing constant `O(1)` fetch times for dashboards by tolerating microscopic data staleness via a split operational vs. analytical schema.
- **Setup Process:** 
  - Set up environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - Use `npm run dev` for local frontend development.
  - Use `npx vercel dev` to invoke the routing behavior and serverless backend API stack logic locally.

### 8. Additional Thoughtfulness
- **Design Excellence:** Instead of deploying a default wireframe, considerable effort was invested into executing a vibrant, premium *Aigentic* styling. This vastly improves the emotional response and perceived value of the internal tool through rounded aesthetics, custom SVG data charts, and soft shadows.
- **Bulk Mock Seeding Tooling:** Built a dedicated "Seed & Tools" tab in the Admin configuration specifically engineered for developers or QA. It allows the one-click generation of randomized, structurally valid financial data to populate the tables and evaluate the chart rendering without manual inputs.