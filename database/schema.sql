DROP DATABASE IF EXISTS blood_bank_management;
CREATE DATABASE blood_bank_management;
USE blood_bank_management;

CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff (
  staff_id INT PRIMARY KEY AUTO_INCREMENT,
  staff_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  job_title VARCHAR(80) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150) UNIQUE,
  shift_name VARCHAR(50) NOT NULL,
  status ENUM('Active', 'On Leave', 'Off Duty') NOT NULL DEFAULT 'Active',
  joined_on DATE DEFAULT (CURRENT_DATE)
);

CREATE TABLE donors (
  donor_id INT PRIMARY KEY AUTO_INCREMENT,
  donor_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') DEFAULT 'Other',
  age INT,
  blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  city VARCHAR(100),
  last_donation_date DATE,
  medical_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  customer_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  hospital_name VARCHAR(150),
  blood_group_needed ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
  units_needed INT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(100),
  status ENUM('Pending', 'Approved', 'Served', 'Cancelled') NOT NULL DEFAULT 'Pending',
  request_date DATE NOT NULL,
  notes TEXT
);

CREATE TABLE blood_inventory (
  inventory_id INT PRIMARY KEY AUTO_INCREMENT,
  blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL UNIQUE,
  units_available INT NOT NULL DEFAULT 0,
  minimum_threshold INT NOT NULL DEFAULT 5,
  storage_location VARCHAR(60) NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE blood_donations (
  donation_id INT PRIMARY KEY AUTO_INCREMENT,
  donor_id INT NOT NULL,
  blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
  units INT NOT NULL,
  donation_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  tested_status ENUM('Screening', 'Cleared', 'Held') NOT NULL DEFAULT 'Screening',
  bag_number VARCHAR(50) NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_donation_donor FOREIGN KEY (donor_id) REFERENCES donors(donor_id)
);

CREATE TABLE blood_requests (
  request_id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
  units_requested INT NOT NULL,
  units_approved INT NOT NULL DEFAULT 0,
  urgency ENUM('Routine', 'Priority', 'Emergency') NOT NULL DEFAULT 'Routine',
  request_status ENUM('Pending', 'Approved', 'Issued', 'Rejected') NOT NULL DEFAULT 'Pending',
  request_date DATE NOT NULL,
  issued_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_request_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

INSERT INTO users (full_name, email, phone, password_hash, role) VALUES
('Aarav Sharma', 'admin@lifeflow.com', '9876543210', 'b3f31a85f2ab24e8b24c2904c73fcc01:d10e3347b369c1321d8e964f8f0f927dc81b448eefd56cd95dbbe95f5789ab3f37d78f0e260e82f7ac7b8b636abe7f3d71db5df41a81d173b5b809ac08fe82a0', 'admin');

INSERT INTO staff (staff_code, full_name, job_title, phone, email, shift_name, status, joined_on) VALUES
('STF-101', 'Riya Verma', 'Lab Supervisor', '9810001122', 'riya.verma@lifeflow.com', 'Morning', 'Active', '2024-03-11'),
('STF-102', 'Daniel Thomas', 'Counsellor', '9810001133', 'daniel.thomas@lifeflow.com', 'Evening', 'Active', '2024-05-20'),
('STF-103', 'Maya Iyer', 'Inventory Officer', '9810001144', 'maya.iyer@lifeflow.com', 'Night', 'On Leave', '2024-08-09');

INSERT INTO donors (donor_code, full_name, gender, age, blood_group, phone, email, city, last_donation_date, medical_notes) VALUES
('DON-1001', 'Kabir Singh', 'Male', 29, 'O+', '9891001111', 'kabir.singh@example.com', 'Delhi', '2026-04-15', 'Regular voluntary donor'),
('DON-1002', 'Ananya Rao', 'Female', 32, 'A+', '9891002222', 'ananya.rao@example.com', 'Noida', '2026-03-02', 'No reported allergy'),
('DON-1003', 'Farhan Ali', 'Male', 27, 'B+', '9891003333', 'farhan.ali@example.com', 'Ghaziabad', '2026-02-12', 'Hydrated well during last visit'),
('DON-1004', 'Sneha Patel', 'Female', 35, 'AB-', '9891004444', 'sneha.patel@example.com', 'Gurugram', '2026-01-29', 'Needs post-donation rest reminder');

INSERT INTO customers (full_name, hospital_name, blood_group_needed, units_needed, phone, city, status, request_date, notes) VALUES
('Meera Khanna', 'City Care Hospital', 'A+', 2, '9877001111', 'Delhi', 'Pending', '2026-05-18', 'Surgery planned this week'),
('Raj Malhotra', 'Sunrise Trauma Center', 'O-', 1, '9877002222', 'Noida', 'Approved', '2026-05-16', 'Emergency case'),
('Nida Sheikh', 'Metro Heart Institute', 'B+', 3, '9877003333', 'Delhi', 'Served', '2026-05-09', 'Platelet support requested'),
('Arjun Nair', 'Hope Multispeciality', 'AB-', 1, '9877004444', 'Gurugram', 'Pending', '2026-05-21', 'Cross-match pending');

INSERT INTO blood_inventory (blood_group, units_available, minimum_threshold, storage_location) VALUES
('A+', 18, 6, 'Rack-A1'),
('A-', 6, 4, 'Rack-A2'),
('B+', 15, 5, 'Rack-B1'),
('B-', 5, 4, 'Rack-B2'),
('AB+', 7, 3, 'Rack-C1'),
('AB-', 3, 3, 'Rack-C2'),
('O+', 21, 7, 'Rack-D1'),
('O-', 4, 4, 'Rack-D2');

INSERT INTO blood_donations (donor_id, blood_group, units, donation_date, expiry_date, tested_status, bag_number, notes) VALUES
(1, 'O+', 2, '2026-05-14', '2026-06-25', 'Cleared', 'BAG-5001', 'Whole blood donation completed smoothly'),
(2, 'A+', 1, '2026-05-11', '2026-06-21', 'Cleared', 'BAG-5002', 'Volunteer camp collection'),
(3, 'B+', 2, '2026-05-08', '2026-06-19', 'Screening', 'BAG-5003', 'Awaiting final review');

INSERT INTO blood_requests (customer_id, blood_group, units_requested, units_approved, urgency, request_status, request_date, issued_date, notes) VALUES
(1, 'A+', 2, 0, 'Priority', 'Pending', '2026-05-18', NULL, 'Awaiting medical officer approval'),
(2, 'O-', 1, 1, 'Emergency', 'Issued', '2026-05-16', '2026-05-16', 'Released to trauma team'),
(4, 'AB-', 1, 0, 'Routine', 'Pending', '2026-05-21', NULL, 'Follow-up after test confirmation');
