import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { API_BASE_URL, apiRequest } from "./api";

const STORAGE_KEY = "lifeflow-session";
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "donors", label: "Donors" },
  { id: "donations", label: "Donations" },
  { id: "inventory", label: "Blood Store" },
  { id: "customers", label: "Customers" },
  { id: "requests", label: "Requests" },
  { id: "staff", label: "Staff" },
  { id: "reports", label: "Reports" }
];

const resourceConfigs = {
  donors: {
    title: "Donor Directory",
    description: "Capture donor details, blood group, city, and basic health notes.",
    endpoint: "/donors",
    singular: "Donor",
    idField: "donor_id",
    searchFields: ["donor_code", "full_name", "blood_group", "phone", "city"],
    columns: [
      { key: "donor_code", label: "Code" },
      { key: "full_name", label: "Name" },
      { key: "blood_group", label: "Group", pill: true },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      { key: "last_donation_date", label: "Last Donation" }
    ],
    fields: [
      { name: "donor_code", label: "Donor Code", type: "text", required: true },
      { name: "full_name", label: "Full Name", type: "text", required: true },
      {
        name: "gender",
        label: "Gender",
        type: "select",
        options: ["Male", "Female", "Other"],
        defaultValue: "Other"
      },
      { name: "age", label: "Age", type: "number" },
      { name: "blood_group", label: "Blood Group", type: "select", options: BLOOD_GROUPS, required: true },
      { name: "phone", label: "Phone", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "city", label: "City", type: "text" },
      { name: "last_donation_date", label: "Last Donation Date", type: "date" },
      { name: "medical_notes", label: "Medical Notes", type: "textarea" }
    ]
  },
  donations: {
    title: "Donation Intake",
    description: "Track collection bags and automatically update stock levels.",
    endpoint: "/donations",
    singular: "Donation",
    idField: "donation_id",
    searchFields: ["bag_number", "donor_name", "blood_group", "tested_status"],
    columns: [
      { key: "bag_number", label: "Bag Number" },
      { key: "donor_name", label: "Donor" },
      { key: "blood_group", label: "Group", pill: true },
      { key: "units", label: "Units" },
      { key: "donation_date", label: "Donation Date" },
      { key: "tested_status", label: "Status" }
    ],
    fields: [
      {
        name: "donor_id",
        label: "Donor",
        type: "select",
        required: true,
        optionsSource: "donors",
        optionValue: "donor_id",
        optionLabel: "full_name"
      },
      { name: "blood_group", label: "Blood Group", type: "select", options: BLOOD_GROUPS, required: true },
      { name: "units", label: "Units", type: "number", required: true, defaultValue: 1 },
      { name: "donation_date", label: "Donation Date", type: "date", required: true },
      { name: "expiry_date", label: "Expiry Date", type: "date", required: true },
      {
        name: "tested_status",
        label: "Testing Status",
        type: "select",
        options: ["Screening", "Cleared", "Held"],
        defaultValue: "Screening"
      },
      { name: "bag_number", label: "Bag Number", type: "text", required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  inventory: {
    title: "Blood Store",
    description: "Manage storage racks, safe stock thresholds, and real-time units.",
    endpoint: "/inventory",
    singular: "Inventory Row",
    allowDelete: false,
    idField: "inventory_id",
    searchFields: ["blood_group", "storage_location"],
    columns: [
      { key: "blood_group", label: "Group", pill: true },
      { key: "units_available", label: "Units Available" },
      { key: "minimum_threshold", label: "Minimum" },
      { key: "storage_location", label: "Storage Location" },
      { key: "last_updated", label: "Last Updated" }
    ],
    fields: [
      { name: "blood_group", label: "Blood Group", type: "select", options: BLOOD_GROUPS, required: true },
      { name: "units_available", label: "Units Available", type: "number", required: true, defaultValue: 0 },
      { name: "minimum_threshold", label: "Minimum Threshold", type: "number", required: true, defaultValue: 5 },
      { name: "storage_location", label: "Storage Location", type: "text", required: true }
    ]
  },
  customers: {
    title: "Customer Details",
    description: "Keep requestor and hospital information in one place.",
    endpoint: "/customers",
    singular: "Customer",
    idField: "customer_id",
    searchFields: ["full_name", "hospital_name", "blood_group_needed", "phone", "city"],
    columns: [
      { key: "full_name", label: "Customer" },
      { key: "hospital_name", label: "Hospital" },
      { key: "blood_group_needed", label: "Needed", pill: true },
      { key: "units_needed", label: "Units" },
      { key: "status", label: "Status" },
      { key: "request_date", label: "Request Date" }
    ],
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "hospital_name", label: "Hospital Name", type: "text" },
      { name: "blood_group_needed", label: "Blood Group Needed", type: "select", options: BLOOD_GROUPS, required: true },
      { name: "units_needed", label: "Units Needed", type: "number", required: true, defaultValue: 1 },
      { name: "phone", label: "Phone", type: "text", required: true },
      { name: "city", label: "City", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Pending", "Approved", "Served", "Cancelled"],
        defaultValue: "Pending"
      },
      { name: "request_date", label: "Request Date", type: "date", required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  requests: {
    title: "Blood Requests",
    description: "Approve units, mark urgency, and update released blood.",
    endpoint: "/requests",
    singular: "Request",
    idField: "request_id",
    searchFields: ["customer_name", "hospital_name", "blood_group", "urgency", "request_status"],
    columns: [
      { key: "customer_name", label: "Customer" },
      { key: "hospital_name", label: "Hospital" },
      { key: "blood_group", label: "Group", pill: true },
      { key: "units_requested", label: "Requested" },
      { key: "units_approved", label: "Approved" },
      { key: "request_status", label: "Status" }
    ],
    fields: [
      {
        name: "customer_id",
        label: "Customer",
        type: "select",
        required: true,
        optionsSource: "customers",
        optionValue: "customer_id",
        optionLabel: "full_name"
      },
      { name: "blood_group", label: "Blood Group", type: "select", options: BLOOD_GROUPS, required: true },
      { name: "units_requested", label: "Units Requested", type: "number", required: true, defaultValue: 1 },
      { name: "units_approved", label: "Units Approved", type: "number", defaultValue: 0 },
      {
        name: "urgency",
        label: "Urgency",
        type: "select",
        options: ["Routine", "Priority", "Emergency"],
        defaultValue: "Routine",
        required: true
      },
      {
        name: "request_status",
        label: "Request Status",
        type: "select",
        options: ["Pending", "Approved", "Issued", "Rejected"],
        defaultValue: "Pending",
        required: true
      },
      { name: "request_date", label: "Request Date", type: "date", required: true },
      { name: "issued_date", label: "Issued Date", type: "date" },
      { name: "notes", label: "Notes", type: "textarea" }
    ]
  },
  staff: {
    title: "Staff Information",
    description: "Store staff contacts, shifts, and basic work status.",
    endpoint: "/staff",
    singular: "Staff Member",
    idField: "staff_id",
    searchFields: ["staff_code", "full_name", "job_title", "shift_name", "status"],
    columns: [
      { key: "staff_code", label: "Code" },
      { key: "full_name", label: "Name" },
      { key: "job_title", label: "Role" },
      { key: "shift_name", label: "Shift" },
      { key: "status", label: "Status" },
      { key: "phone", label: "Phone" }
    ],
    fields: [
      { name: "staff_code", label: "Staff Code", type: "text", required: true },
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "job_title", label: "Job Title", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "shift_name", label: "Shift Name", type: "text", required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Active", "On Leave", "Off Duty"],
        defaultValue: "Active"
      },
      { name: "joined_on", label: "Joined On", type: "date" }
    ]
  }
};

function createEmptyForm(config) {
  return config.fields.reduce((accumulator, field) => {
    accumulator[field.name] = field.defaultValue ?? "";
    return accumulator;
  }, {});
}

function readSession() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (_error) {
    return null;
  }
}

function App() {
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <AuthPage mode="login" onAuth={setSession} />}
      />
      <Route
        path="/register"
        element={session ? <Navigate to="/" replace /> : <AuthPage mode="register" onAuth={setSession} />}
      />
      <Route
        path="/"
        element={session ? <Dashboard session={session} onLogout={() => setSession(null)} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={session ? "/" : "/login"} replace />} />
    </Routes>
  );
}

function AuthPage({ mode, onAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [formState, setFormState] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "staff"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [location.pathname]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email: formState.email, password: formState.password } : formState;
      const response = await apiRequest(endpoint, {
        method: "POST",
        body: payload
      });

      onAuth({
        token: response.token,
        user: response.user
      });

      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="hero-panel">
        <span className="hero-chip">LifeFlow Dashboard</span>
        <h1>Blood bank operations with a cleaner, safer, more modern workflow.</h1>
        <p>
          Manage donors, stock, hospital requests, customer records, staff information, and reports from one React
          dashboard backed by Node.js and MySQL.
        </p>
        <div className="hero-grid">
          <article className="highlight-card">
            <strong>Smart stock view</strong>
            <span>Track blood groups, storage racks, and low inventory warnings in one place.</span>
          </article>
          <article className="highlight-card">
            <strong>Customer and donor records</strong>
            <span>Save details for donors, hospitals, blood requests, and service follow-up.</span>
          </article>
          <article className="highlight-card">
            <strong>Reports section</strong>
            <span>Review demand, donation activity, and blood store health without extra spreadsheets.</span>
          </article>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card-top">
          <p>{mode === "login" ? "Welcome back" : "Create account"}</p>
          <h2>{mode === "login" ? "Login to LifeFlow" : "Register for LifeFlow"}</h2>
          <span className="api-link">API: {API_BASE_URL}</span>
        </div>

        <div className="switch-row">
          <Link className={mode === "login" ? "switch-link active" : "switch-link"} to="/login">
            Login
          </Link>
          <Link className={mode === "register" ? "switch-link active" : "switch-link"} to="/register">
            Registration
          </Link>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <>
              <label>
                <span>Full Name</span>
                <input
                  type="text"
                  value={formState.full_name}
                  onChange={(event) => setFormState({ ...formState, full_name: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Phone</span>
                <input
                  type="text"
                  value={formState.phone}
                  onChange={(event) => setFormState({ ...formState, phone: event.target.value })}
                />
              </label>
              <label>
                <span>Role</span>
                <select value={formState.role} onChange={(event) => setFormState({ ...formState, role: event.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={formState.email}
              onChange={(event) => setFormState({ ...formState, email: event.target.value })}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={formState.password}
              onChange={(event) => setFormState({ ...formState, password: event.target.value })}
              required
            />
          </label>

          {error ? <div className="notice error">{error}</div> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        <div className="demo-box">
          <strong>Demo admin</strong>
          <span>Email: admin@lifeflow.com</span>
          <span>Password: admin123</span>
        </div>
      </section>
    </div>
  );
}

function Dashboard({ session, onLogout }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [dashboardData, setDashboardData] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [resources, setResources] = useState({
    donors: [],
    donations: [],
    inventory: [],
    customers: [],
    requests: [],
    staff: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  async function loadWorkspace() {
    setLoading(true);
    setError("");

    try {
      const [summary, donors, donations, inventory, customers, requests, staff, reports] = await Promise.all([
        apiRequest("/dashboard/summary", { token: session.token }),
        apiRequest("/donors", { token: session.token }),
        apiRequest("/donations", { token: session.token }),
        apiRequest("/inventory", { token: session.token }),
        apiRequest("/customers", { token: session.token }),
        apiRequest("/requests", { token: session.token }),
        apiRequest("/staff", { token: session.token }),
        apiRequest("/reports/overview", { token: session.token })
      ]);

      setDashboardData(summary);
      setReportData(reports);
      setResources({
        donors,
        donations,
        inventory,
        customers,
        requests,
        staff
      });
    } catch (requestError) {
      if (requestError.message.toLowerCase().includes("token")) {
        onLogout();
        return;
      }

      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  async function handleSave(sectionId, payload, id) {
    const config = resourceConfigs[sectionId];

    setSaving(true);
    setBanner("");
    setError("");

    try {
      await apiRequest(id ? `${config.endpoint}/${id}` : config.endpoint, {
        method: id ? "PUT" : "POST",
        token: session.token,
        body: payload
      });

      setBanner(`${config.singular} ${id ? "updated" : "created"} successfully.`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sectionId, id) {
    const config = resourceConfigs[sectionId];

    setSaving(true);
    setBanner("");
    setError("");

    try {
      await apiRequest(`${config.endpoint}/${id}`, {
        method: "DELETE",
        token: session.token
      });

      setBanner(`${config.singular} deleted successfully.`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  let content = <OverviewPanel data={dashboardData} />;

  if (activeSection === "reports") {
    content = <ReportsPanel data={reportData} />;
  } else if (activeSection !== "overview") {
    const config = resourceConfigs[activeSection];
    content = (
      <ResourcePanel
        config={config}
        rows={resources[activeSection]}
        relatedData={resources}
        busy={saving}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="hero-chip">LifeFlow</span>
          <h2>Blood Bank</h2>
          <p>Modern control room for donors, customers, staff, stock, and reports.</p>
        </div>

        <nav className="nav-stack">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={item.id === activeSection ? "nav-button active" : "nav-button"}
              onClick={() => setActiveSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <strong>{session.user.full_name}</strong>
          <span>{session.user.role}</span>
          <span>{session.user.email}</span>
          <button type="button" className="ghost-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Blood Bank Management System</p>
            <h1>{navItems.find((item) => item.id === activeSection)?.label || "Overview"}</h1>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">Connected to Node + MySQL</span>
            <button className="secondary-button" type="button" onClick={loadWorkspace}>
              Refresh Data
            </button>
          </div>
        </header>

        {banner ? <div className="notice success">{banner}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        {loading ? <div className="panel loading-panel">Loading dashboard data...</div> : content}
      </main>
    </div>
  );
}

function OverviewPanel({ data }) {
  if (!data) {
    return <div className="panel">Dashboard data is not available yet.</div>;
  }

  const summaryCards = [
    { label: "Registered Donors", value: data.summary.donorCount },
    { label: "Customer Records", value: data.summary.customerCount },
    { label: "Staff Members", value: data.summary.staffCount },
    { label: "Pending Requests", value: data.summary.pendingRequests },
    { label: "Total Units in Store", value: data.summary.totalUnits }
  ];

  return (
    <div className="dashboard-grid">
      <section className="metric-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="metric-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel two-column">
        <div>
          <div className="section-heading">
            <h3>Low Stock Alerts</h3>
            <span>Blood groups close to the safety limit</span>
          </div>
          <div className="list-stack">
            {data.lowStock.length ? (
              data.lowStock.map((item) => (
                <div key={item.inventory_id} className="list-row">
                  <div>
                    <strong>{item.blood_group}</strong>
                    <span>{item.storage_location}</span>
                  </div>
                  <span className="danger-pill">{item.units_available} units</span>
                </div>
              ))
            ) : (
              <div className="empty-state">All blood groups are above the minimum stock threshold.</div>
            )}
          </div>
        </div>

        <div>
          <div className="section-heading">
            <h3>Recent Donations</h3>
            <span>Latest donor bags added to storage</span>
          </div>
          <div className="list-stack">
            {data.recentDonations.map((item) => (
              <div key={item.donation_id} className="list-row">
                <div>
                  <strong>{item.donor_name}</strong>
                  <span>
                    {item.blood_group} / {item.donation_date}
                  </span>
                </div>
                <span className="success-pill">{item.units} units</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h3>Recent Blood Requests</h3>
          <span>Track customer demand and hospital urgency</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Hospital</th>
                <th>Group</th>
                <th>Requested</th>
                <th>Approved</th>
                <th>Urgency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRequests.map((item) => (
                <tr key={item.request_id}>
                  <td>{item.customer_name}</td>
                  <td>{item.hospital_name || "Walk-in"}</td>
                  <td>
                    <span className="table-pill">{item.blood_group}</span>
                  </td>
                  <td>{item.units_requested}</td>
                  <td>{item.units_approved}</td>
                  <td>{item.urgency}</td>
                  <td>{item.request_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResourcePanel({ config, rows, relatedData, onSave, onDelete, busy }) {
  const sectionId = config.endpoint.slice(1);
  const [formState, setFormState] = useState(createEmptyForm(config));
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setFormState(createEmptyForm(config));
    setEditingId(null);
    setLocalError("");
    setQuery("");
  }, [config.idField]);

  const filteredRows = rows.filter((row) => {
    if (!query.trim()) {
      return true;
    }

    const haystack = config.searchFields.map((field) => String(row[field] || "").toLowerCase()).join(" ");
    return haystack.includes(query.toLowerCase());
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setLocalError("");

    try {
      await onSave(sectionId, serializeFormState(config.fields, formState), editingId);
      setFormState(createEmptyForm(config));
      setEditingId(null);
    } catch (requestError) {
      setLocalError(requestError.message);
    }
  }

  function startEdit(row) {
    setEditingId(row[config.idField]);
    setFormState(
      config.fields.reduce((accumulator, field) => {
        accumulator[field.name] = normalizeFieldValue(field, row[field.name]);
        return accumulator;
      }, {})
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setFormState(createEmptyForm(config));
    setLocalError("");
  }

  return (
    <div className="resource-layout">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>{config.title}</h3>
            <span>{config.description}</span>
          </div>
          <input
            className="search-input"
            type="search"
            placeholder={`Search ${config.singular.toLowerCase()}s`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row[config.idField]}>
                  {config.columns.map((column) => (
                    <td key={column.key}>
                      {column.pill ? <span className="table-pill">{row[column.key]}</span> : formatCell(row[column.key])}
                    </td>
                  ))}
                  <td className="action-row">
                    <button type="button" className="tiny-button" onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    {config.allowDelete === false ? null : (
                      <button
                        type="button"
                        className="tiny-button danger"
                        onClick={() => onDelete(sectionId, row[config.idField])}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 ? <div className="empty-state">No records match the current search.</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>{editingId ? `Edit ${config.singular}` : `Add ${config.singular}`}</h3>
            <span>Use the form below to keep this section up to date.</span>
          </div>
          {editingId ? (
            <button type="button" className="ghost-button" onClick={cancelEdit}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form className="resource-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            {config.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={formState[field.name]}
                relatedData={relatedData}
                onChange={(value) => setFormState({ ...formState, [field.name]: value })}
              />
            ))}
          </div>

          {localError ? <div className="notice error">{localError}</div> : null}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Saving..." : editingId ? `Update ${config.singular}` : `Create ${config.singular}`}
          </button>
        </form>
      </section>
    </div>
  );
}

function ReportsPanel({ data }) {
  if (!data) {
    return <div className="panel">Report data is not available yet.</div>;
  }

  const maxUnits = Math.max(...data.stockLevels.map((item) => Number(item.units_available)), 1);

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>Blood Stock Report</h3>
            <span>Generated at {new Date(data.generatedAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="report-grid">
          {data.stockLevels.map((item) => (
            <article key={item.blood_group} className="report-card">
              <div className="report-card-top">
                <strong>{item.blood_group}</strong>
                <span
                  className={
                    item.stock_state === "Low"
                      ? "danger-pill"
                      : item.stock_state === "Watch"
                        ? "warning-pill"
                        : "success-pill"
                  }
                >
                  {item.stock_state}
                </span>
              </div>
              <p>{item.storage_location}</p>
              <div className="report-bar">
                <span style={{ width: `${(Number(item.units_available) / maxUnits) * 100}%` }} />
              </div>
              <small>
                {item.units_available} units available / minimum {item.minimum_threshold}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel two-column">
        <div>
          <div className="section-heading">
            <h3>Request Breakdown</h3>
            <span>How requests are moving through the bank</span>
          </div>
          <div className="list-stack">
            {data.requestBreakdown.map((item) => (
              <div key={item.label} className="list-row">
                <strong>{item.label}</strong>
                <span className="table-pill">{item.total}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-heading">
            <h3>Monthly Donation Units</h3>
            <span>Recent blood collection trend</span>
          </div>
          <div className="list-stack">
            {data.monthlyDonations.map((item) => (
              <div key={item.month_label} className="list-row">
                <strong>{item.month_label}</strong>
                <span className="success-pill">{item.units} units</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel two-column">
        <div>
          <div className="section-heading">
            <h3>Top Donors</h3>
            <span>Highest contribution across logged donations</span>
          </div>
          <div className="list-stack">
            {data.topDonors.map((item) => (
              <div key={item.full_name} className="list-row">
                <div>
                  <strong>{item.full_name}</strong>
                  <span>{item.blood_group}</span>
                </div>
                <span className="table-pill">{item.total_units} units</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-heading">
            <h3>Recent Customer Demand</h3>
            <span>Latest hospitals and service requests</span>
          </div>
          <div className="list-stack">
            {data.recentDemand.map((item) => (
              <div key={`${item.full_name}-${item.request_date}`} className="list-row">
                <div>
                  <strong>{item.full_name}</strong>
                  <span>
                    {item.hospital_name || "Walk-in"} / {item.request_date}
                  </span>
                </div>
                <span className="warning-pill">
                  {item.blood_group_needed} / {item.units_needed} units
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FieldInput({ field, value, relatedData, onChange }) {
  const options = field.optionsSource
    ? (relatedData[field.optionsSource] || []).map((item) => ({
        value: item[field.optionValue],
        label: item[field.optionLabel]
      }))
    : (field.options || []).map((item) => ({ value: item, label: item }));

  if (field.type === "textarea") {
    return (
      <label className="field wide">
        <span>{field.label}</span>
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} required={field.required}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={`${field.name}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        type={field.type}
        value={value}
        required={field.required}
        min={field.type === "number" ? 0 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function serializeFormState(fields, formState) {
  return fields.reduce((accumulator, field) => {
    const rawValue = formState[field.name];

    if (field.type === "number") {
      if (rawValue === "") {
        return accumulator;
      }

      accumulator[field.name] = Number(rawValue);
      return accumulator;
    }

    if (field.type === "date") {
      accumulator[field.name] = rawValue || null;
      return accumulator;
    }

    accumulator[field.name] = rawValue === "" ? null : rawValue;
    return accumulator;
  }, {});
}

function normalizeFieldValue(field, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (field.type === "date") {
    return String(value).slice(0, 10);
  }

  return String(value);
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return value;
}

export default App;
