export default function Architecture() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-6">
        <div className="text-sm text-gray-500">Backend system design</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Two-layer data architecture</h1>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <div className="text-sm font-semibold">Primary (Core) DB</div>
            <p className="mt-2 text-sm text-gray-500">
              Source of truth for transactional data and access control. This layer is optimized for correctness and auditability.
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm text-gray-500 space-y-1">
              <li><span className="text-gray-900">core_user_roles</span>: role assignments + active/inactive status</li>
              <li><span className="text-gray-900">core_financial_records</span>: income/expense transactions (soft delete)</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <div className="text-sm font-semibold">Read-optimized layer</div>
            <p className="mt-2 text-sm text-gray-500">
              Precomputed aggregates to serve dashboard APIs quickly. This isolates expensive computations from the user-facing request path.
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm text-gray-500 space-y-1">
              <li><span className="text-gray-900">read_dashboard_summaries</span>: totals + net balance</li>
              <li><span className="text-gray-900">read_category_totals</span>: per-category totals by type</li>
              <li><span className="text-gray-900">read_trends_monthly</span>: time-series aggregates</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <div className="text-sm font-semibold">Data flow</div>
          <ol className="mt-3 list-decimal pl-5 text-sm text-gray-500 space-y-1">
            <li>User creates/updates records via <span className="text-gray-900">/api/records</span> (writes core layer)</li>
            <li>API triggers a best-effort refresh that recomputes aggregates and upserts into <span className="text-gray-900">read_*</span> tables</li>
            <li>Dashboard reads from <span className="text-gray-900">/api/dashboard</span> (read layer) and shows recent transactions from core</li>
            <li>Analyst/Admin can also call <span className="text-gray-900">/api/readmodel_refresh</span> to refresh on-demand</li>
          </ol>
          <p className="mt-3 text-xs text-gray-500">
            In production you’d typically run this refresh via background jobs / queues or database triggers. Here we model it explicitly.
          </p>
        </div>
      </div>
    </div>
  );
}
