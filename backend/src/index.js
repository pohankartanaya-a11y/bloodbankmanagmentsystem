require("dotenv").config();

const cors = require("cors");
const express = require("express");

const pool = require("./config/db");
const authenticate = require("./middleware/auth");
const { hashPassword, signToken, verifyPassword } = require("./utils/security");

const app = express();
const port = Number(process.env.PORT || 5000);

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const APPROVAL_STATUSES = new Set(["Approved", "Issued"]);

const simpleResources = [
  {
    resource: "donors",
    entityName: "donor",
    table: "donors",
    primaryKey: "donor_id",
    orderBy: "created_at DESC, donor_id DESC",
    requiredFields: ["donor_code", "full_name", "blood_group", "phone"],
    fields: [
      "donor_code",
      "full_name",
      "gender",
      "age",
      "blood_group",
      "phone",
      "email",
      "city",
      "last_donation_date",
      "medical_notes"
    ]
  },
  {
    resource: "customers",
    entityName: "customer",
    table: "customers",
    primaryKey: "customer_id",
    orderBy: "request_date DESC, customer_id DESC",
    requiredFields: ["full_name", "blood_group_needed", "units_needed", "phone", "request_date"],
    fields: [
      "full_name",
      "hospital_name",
      "blood_group_needed",
      "units_needed",
      "phone",
      "city",
      "status",
      "request_date",
      "notes"
    ]
  },
  {
    resource: "staff",
    entityName: "staff member",
    table: "staff",
    primaryKey: "staff_id",
    orderBy: "joined_on DESC, staff_id DESC",
    requiredFields: ["staff_code", "full_name", "job_title", "phone", "shift_name"],
    fields: [
      "staff_code",
      "full_name",
      "job_title",
      "phone",
      "email",
      "shift_name",
      "status",
      "joined_on"
    ]
  },
  {
    resource: "inventory",
    entityName: "inventory row",
    table: "blood_inventory",
    primaryKey: "inventory_id",
    orderBy: "FIELD(blood_group, 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')",
    requiredFields: ["blood_group", "units_available", "minimum_threshold", "storage_location"],
    fields: ["blood_group", "units_available", "minimum_threshold", "storage_location"]
  }
];

app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : true }));
app.use(express.json());

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function pickFields(source, fields) {
  return fields.reduce((accumulator, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      accumulator[field] = source[field];
    }

    return accumulator;
  }, {});
}

function validateRequired(payload, requiredFields) {
  const missingFields = requiredFields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw createHttpError(400, `Missing required fields: ${missingFields.join(", ")}`);
  }
}

function buildInsertStatement(table, payload) {
  const keys = Object.keys(payload);
  const columns = keys.join(", ");
  const placeholders = keys.map(() => "?").join(", ");

  return {
    sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    values: keys.map((key) => payload[key])
  };
}

function buildUpdateStatement(table, primaryKey, id, payload) {
  const keys = Object.keys(payload);

  if (keys.length === 0) {
    throw createHttpError(400, "No fields were provided for update.");
  }

  return {
    sql: `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE ${primaryKey} = ?`,
    values: [...keys.map((key) => payload[key]), id]
  };
}

async function fetchRowById(connection, table, primaryKey, id) {
  const [rows] = await connection.query(`SELECT * FROM ${table} WHERE ${primaryKey} = ?`, [id]);
  return rows[0];
}

async function adjustInventory(connection, bloodGroup, unitsChange) {
  const parsedUnits = Number(unitsChange || 0);

  if (!parsedUnits) {
    return;
  }

  const [rows] = await connection.query(
    "SELECT inventory_id, units_available FROM blood_inventory WHERE blood_group = ? FOR UPDATE",
    [bloodGroup]
  );

  if (rows.length === 0) {
    throw createHttpError(400, `Inventory row for ${bloodGroup} is missing.`);
  }

  const currentUnits = Number(rows[0].units_available || 0);
  const nextUnits = currentUnits + parsedUnits;

  if (nextUnits < 0) {
    throw createHttpError(400, `Not enough ${bloodGroup} stock available for this action.`);
  }

  await connection.query(
    "UPDATE blood_inventory SET units_available = ?, last_updated = NOW() WHERE inventory_id = ?",
    [nextUnits, rows[0].inventory_id]
  );
}

function validateBloodGroup(group) {
  if (!BLOOD_GROUPS.includes(group)) {
    throw createHttpError(400, "Blood group is invalid.");
  }
}

function validateApprovedUnits(payload) {
  const requested = Number(payload.units_requested || 0);
  const approved = Number(payload.units_approved || 0);

  if (approved > requested) {
    throw createHttpError(400, "Approved units cannot be greater than requested units.");
  }
}

function sanitizeUser(userRow) {
  return {
    user_id: userRow.user_id,
    full_name: userRow.full_name,
    email: userRow.email,
    phone: userRow.phone,
    role: userRow.role,
    created_at: userRow.created_at
  };
}

app.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT NOW() AS server_time");
    res.json({ status: "ok", serverTime: rows[0].server_time });
  })
);

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const payload = pickFields(req.body, ["full_name", "email", "phone", "password", "role"]);
    validateRequired(payload, ["full_name", "email", "password"]);

    const safePayload = {
      full_name: payload.full_name,
      email: String(payload.email).toLowerCase(),
      phone: payload.phone || null,
      password_hash: hashPassword(payload.password),
      role: payload.role || "staff"
    };

    const { sql, values } = buildInsertStatement("users", safePayload);
    const [result] = await pool.query(sql, values);
    const createdUser = await fetchRowById(pool, "users", "user_id", result.insertId);
    const token = signToken(createdUser);

    res.status(201).json({
      message: "Registration completed successfully.",
      token,
      user: sanitizeUser(createdUser)
    });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    validateRequired({ email, password }, ["email", "password"]);

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [String(email).toLowerCase()]);
    const user = rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw createHttpError(401, "Email or password is incorrect.");
    }

    res.json({
      message: "Login successful.",
      token: signToken(user),
      user: sanitizeUser(user)
    });
  })
);

app.get(
  "/api/dashboard/summary",
  authenticate,
  asyncHandler(async (_req, res) => {
    const [[summary]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM donors) AS donorCount,
        (SELECT COUNT(*) FROM customers) AS customerCount,
        (SELECT COUNT(*) FROM staff) AS staffCount,
        (SELECT COUNT(*) FROM blood_requests WHERE request_status = 'Pending') AS pendingRequests,
        (SELECT IFNULL(SUM(units_available), 0) FROM blood_inventory) AS totalUnits
    `);

    const [lowStock] = await pool.query(`
      SELECT inventory_id, blood_group, units_available, minimum_threshold, storage_location
      FROM blood_inventory
      WHERE units_available <= minimum_threshold
      ORDER BY units_available ASC, blood_group ASC
    `);

    const [recentDonations] = await pool.query(`
      SELECT bd.donation_id, bd.blood_group, bd.units, bd.donation_date, bd.tested_status, d.full_name AS donor_name
      FROM blood_donations bd
      LEFT JOIN donors d ON d.donor_id = bd.donor_id
      ORDER BY bd.donation_date DESC, bd.donation_id DESC
      LIMIT 5
    `);

    const [recentRequests] = await pool.query(`
      SELECT br.request_id, br.blood_group, br.units_requested, br.units_approved, br.urgency, br.request_status,
             c.full_name AS customer_name, c.hospital_name
      FROM blood_requests br
      LEFT JOIN customers c ON c.customer_id = br.customer_id
      ORDER BY br.request_date DESC, br.request_id DESC
      LIMIT 5
    `);

    res.json({
      summary,
      lowStock,
      recentDonations,
      recentRequests
    });
  })
);

for (const config of simpleResources) {
  app.get(
    `/api/${config.resource}`,
    authenticate,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.query(`SELECT * FROM ${config.table} ORDER BY ${config.orderBy}`);
      res.json(rows);
    })
  );

  app.post(
    `/api/${config.resource}`,
    authenticate,
    asyncHandler(async (req, res) => {
      const payload = pickFields(req.body, config.fields);
      validateRequired(payload, config.requiredFields);

      if (payload.blood_group) {
        validateBloodGroup(payload.blood_group);
      }

      if (payload.blood_group_needed) {
        validateBloodGroup(payload.blood_group_needed);
      }

      const { sql, values } = buildInsertStatement(config.table, payload);
      const [result] = await pool.query(sql, values);
      const row = await fetchRowById(pool, config.table, config.primaryKey, result.insertId);

      res.status(201).json(row);
    })
  );

  app.put(
    `/api/${config.resource}/:id`,
    authenticate,
    asyncHandler(async (req, res) => {
      const payload = pickFields(req.body, config.fields);
      const existingRow = await fetchRowById(pool, config.table, config.primaryKey, req.params.id);

      if (!existingRow) {
        throw createHttpError(404, `${config.entityName} was not found.`);
      }

      if (payload.blood_group) {
        validateBloodGroup(payload.blood_group);
      }

      if (payload.blood_group_needed) {
        validateBloodGroup(payload.blood_group_needed);
      }

      const mergedPayload = { ...existingRow, ...payload };
      validateRequired(mergedPayload, config.requiredFields);

      const { sql, values } = buildUpdateStatement(config.table, config.primaryKey, req.params.id, payload);
      await pool.query(sql, values);
      const updatedRow = await fetchRowById(pool, config.table, config.primaryKey, req.params.id);

      res.json(updatedRow);
    })
  );

  app.delete(
    `/api/${config.resource}/:id`,
    authenticate,
    asyncHandler(async (req, res) => {
      const existingRow = await fetchRowById(pool, config.table, config.primaryKey, req.params.id);

      if (!existingRow) {
        throw createHttpError(404, `${config.entityName} was not found.`);
      }

      if (config.resource === "inventory") {
        throw createHttpError(400, "Inventory rows cannot be deleted. Update the stock values instead.");
      }

      await pool.query(`DELETE FROM ${config.table} WHERE ${config.primaryKey} = ?`, [req.params.id]);
      res.json({ message: `${config.entityName} deleted successfully.` });
    })
  );
}

app.get(
  "/api/donations",
  authenticate,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`
      SELECT bd.*, d.full_name AS donor_name, d.phone AS donor_phone
      FROM blood_donations bd
      LEFT JOIN donors d ON d.donor_id = bd.donor_id
      ORDER BY bd.donation_date DESC, bd.donation_id DESC
    `);

    res.json(rows);
  })
);

app.post(
  "/api/donations",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = pickFields(req.body, [
      "donor_id",
      "blood_group",
      "units",
      "donation_date",
      "expiry_date",
      "tested_status",
      "bag_number",
      "notes"
    ]);

    validateRequired(payload, ["donor_id", "blood_group", "units", "donation_date", "expiry_date", "bag_number"]);
    validateBloodGroup(payload.blood_group);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const insertPayload = {
        ...payload,
        units: Number(payload.units),
        tested_status: payload.tested_status || "Screening"
      };

      const { sql, values } = buildInsertStatement("blood_donations", insertPayload);
      const [result] = await connection.query(sql, values);

      await adjustInventory(connection, payload.blood_group, Number(payload.units));
      await connection.commit();

      const [rows] = await pool.query(
        `
          SELECT bd.*, d.full_name AS donor_name, d.phone AS donor_phone
          FROM blood_donations bd
          LEFT JOIN donors d ON d.donor_id = bd.donor_id
          WHERE bd.donation_id = ?
        `,
        [result.insertId]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.put(
  "/api/donations/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = pickFields(req.body, [
      "donor_id",
      "blood_group",
      "units",
      "donation_date",
      "expiry_date",
      "tested_status",
      "bag_number",
      "notes"
    ]);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingDonation = await fetchRowById(connection, "blood_donations", "donation_id", req.params.id);

      if (!existingDonation) {
        throw createHttpError(404, "Donation was not found.");
      }

      const mergedPayload = {
        ...existingDonation,
        ...payload,
        units: payload.units !== undefined ? Number(payload.units) : Number(existingDonation.units)
      };

      validateRequired(mergedPayload, ["donor_id", "blood_group", "units", "donation_date", "expiry_date", "bag_number"]);
      validateBloodGroup(mergedPayload.blood_group);

      await adjustInventory(connection, existingDonation.blood_group, -Number(existingDonation.units));
      await adjustInventory(connection, mergedPayload.blood_group, Number(mergedPayload.units));

      const { sql, values } = buildUpdateStatement("blood_donations", "donation_id", req.params.id, payload);
      await connection.query(sql, values);
      await connection.commit();

      const [rows] = await pool.query(
        `
          SELECT bd.*, d.full_name AS donor_name, d.phone AS donor_phone
          FROM blood_donations bd
          LEFT JOIN donors d ON d.donor_id = bd.donor_id
          WHERE bd.donation_id = ?
        `,
        [req.params.id]
      );

      res.json(rows[0]);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.delete(
  "/api/donations/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingDonation = await fetchRowById(connection, "blood_donations", "donation_id", req.params.id);

      if (!existingDonation) {
        throw createHttpError(404, "Donation was not found.");
      }

      await adjustInventory(connection, existingDonation.blood_group, -Number(existingDonation.units));
      await connection.query("DELETE FROM blood_donations WHERE donation_id = ?", [req.params.id]);
      await connection.commit();

      res.json({ message: "Donation deleted successfully." });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.get(
  "/api/requests",
  authenticate,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`
      SELECT br.*, c.full_name AS customer_name, c.hospital_name, c.phone AS customer_phone
      FROM blood_requests br
      LEFT JOIN customers c ON c.customer_id = br.customer_id
      ORDER BY br.request_date DESC, br.request_id DESC
    `);

    res.json(rows);
  })
);

app.post(
  "/api/requests",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = pickFields(req.body, [
      "customer_id",
      "blood_group",
      "units_requested",
      "units_approved",
      "urgency",
      "request_status",
      "request_date",
      "issued_date",
      "notes"
    ]);

    validateRequired(payload, ["customer_id", "blood_group", "units_requested", "urgency", "request_status", "request_date"]);
    validateBloodGroup(payload.blood_group);

    const requestPayload = {
      ...payload,
      units_requested: Number(payload.units_requested),
      units_approved: Number(payload.units_approved || 0)
    };

    validateApprovedUnits(requestPayload);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (APPROVAL_STATUSES.has(requestPayload.request_status) && requestPayload.units_approved > 0) {
        await adjustInventory(connection, requestPayload.blood_group, -requestPayload.units_approved);
      }

      const { sql, values } = buildInsertStatement("blood_requests", requestPayload);
      const [result] = await connection.query(sql, values);
      await connection.commit();

      const [rows] = await pool.query(
        `
          SELECT br.*, c.full_name AS customer_name, c.hospital_name, c.phone AS customer_phone
          FROM blood_requests br
          LEFT JOIN customers c ON c.customer_id = br.customer_id
          WHERE br.request_id = ?
        `,
        [result.insertId]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.put(
  "/api/requests/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = pickFields(req.body, [
      "customer_id",
      "blood_group",
      "units_requested",
      "units_approved",
      "urgency",
      "request_status",
      "request_date",
      "issued_date",
      "notes"
    ]);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingRequest = await fetchRowById(connection, "blood_requests", "request_id", req.params.id);

      if (!existingRequest) {
        throw createHttpError(404, "Request was not found.");
      }

      const mergedPayload = {
        ...existingRequest,
        ...payload,
        units_requested:
          payload.units_requested !== undefined ? Number(payload.units_requested) : Number(existingRequest.units_requested),
        units_approved:
          payload.units_approved !== undefined ? Number(payload.units_approved) : Number(existingRequest.units_approved)
      };

      validateRequired(mergedPayload, ["customer_id", "blood_group", "units_requested", "urgency", "request_status", "request_date"]);
      validateBloodGroup(mergedPayload.blood_group);
      validateApprovedUnits(mergedPayload);

      if (APPROVAL_STATUSES.has(existingRequest.request_status) && Number(existingRequest.units_approved) > 0) {
        await adjustInventory(connection, existingRequest.blood_group, Number(existingRequest.units_approved));
      }

      if (APPROVAL_STATUSES.has(mergedPayload.request_status) && Number(mergedPayload.units_approved) > 0) {
        await adjustInventory(connection, mergedPayload.blood_group, -Number(mergedPayload.units_approved));
      }

      const { sql, values } = buildUpdateStatement("blood_requests", "request_id", req.params.id, payload);
      await connection.query(sql, values);
      await connection.commit();

      const [rows] = await pool.query(
        `
          SELECT br.*, c.full_name AS customer_name, c.hospital_name, c.phone AS customer_phone
          FROM blood_requests br
          LEFT JOIN customers c ON c.customer_id = br.customer_id
          WHERE br.request_id = ?
        `,
        [req.params.id]
      );

      res.json(rows[0]);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.delete(
  "/api/requests/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingRequest = await fetchRowById(connection, "blood_requests", "request_id", req.params.id);

      if (!existingRequest) {
        throw createHttpError(404, "Request was not found.");
      }

      if (APPROVAL_STATUSES.has(existingRequest.request_status) && Number(existingRequest.units_approved) > 0) {
        await adjustInventory(connection, existingRequest.blood_group, Number(existingRequest.units_approved));
      }

      await connection.query("DELETE FROM blood_requests WHERE request_id = ?", [req.params.id]);
      await connection.commit();

      res.json({ message: "Request deleted successfully." });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

app.get(
  "/api/reports/overview",
  authenticate,
  asyncHandler(async (_req, res) => {
    const [stockLevels] = await pool.query(`
      SELECT blood_group, units_available, minimum_threshold, storage_location,
             CASE
               WHEN units_available <= minimum_threshold THEN 'Low'
               WHEN units_available <= minimum_threshold + 5 THEN 'Watch'
               ELSE 'Healthy'
             END AS stock_state
      FROM blood_inventory
      ORDER BY FIELD(blood_group, 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    `);

    const [requestBreakdown] = await pool.query(`
      SELECT request_status AS label, COUNT(*) AS total
      FROM blood_requests
      GROUP BY request_status
      ORDER BY total DESC, label ASC
    `);

    const [monthlyDonations] = await pool.query(`
      SELECT DATE_FORMAT(donation_date, '%Y-%m') AS month_label, IFNULL(SUM(units), 0) AS units
      FROM blood_donations
      GROUP BY DATE_FORMAT(donation_date, '%Y-%m')
      ORDER BY month_label DESC
      LIMIT 6
    `);

    const [topDonors] = await pool.query(`
      SELECT d.full_name, d.blood_group, COUNT(bd.donation_id) AS donation_count, IFNULL(SUM(bd.units), 0) AS total_units
      FROM donors d
      LEFT JOIN blood_donations bd ON bd.donor_id = d.donor_id
      GROUP BY d.donor_id
      ORDER BY total_units DESC, donation_count DESC, d.full_name ASC
      LIMIT 5
    `);

    const [recentDemand] = await pool.query(`
      SELECT c.full_name, c.hospital_name, c.blood_group_needed, c.units_needed, c.status, c.request_date
      FROM customers c
      ORDER BY c.request_date DESC, c.customer_id DESC
      LIMIT 6
    `);

    res.json({
      generatedAt: new Date().toISOString(),
      stockLevels,
      requestBreakdown,
      monthlyDonations: monthlyDonations.reverse(),
      topDonors,
      recentDemand
    });
  })
);

app.use((error, _req, res, _next) => {
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "A record with the same unique value already exists." });
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ message: "The referenced record does not exist." });
  }

  if (error.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({ message: "This record is linked to other blood bank data and cannot be deleted." });
  }

  const status = error.status || 500;
  const message = error.message || "Internal server error.";

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json({ message });
});

app.listen(port, () => {
  console.log(`Blood bank API running on http://localhost:${port}`);
});
