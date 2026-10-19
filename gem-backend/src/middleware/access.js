const { requireRole } = require('./auth.middleware');

// Who may WRITE through each part of the API.
//
// Before this, access control existed only in the sidebar: a page was hidden
// from a role, but the API behind it answered anyone with a login. A trainer
// could delete members or reprice packages straight through the API.
//
// These groups follow the page access each role already has (ROLE_PROFILES in
// the frontend), so nothing anyone legitimately does today is taken away, and
// destructive or financial actions are held to management. Finer rules - who
// may act on which person - live in utils/hierarchy.js and the controllers.

const ALL = ['general_manager', 'manager', 'front_desk', 'trainer', 'instructor', 'coach'];

// The owner alone: gym-wide settings and payroll
const OWNER = ['general_manager'];

// Management: staff, packages, prices, deletions, time card sign-off
const MANAGEMENT = ['general_manager', 'manager'];

// Front of house: taking payments, checking people in, selling, desk expenses
const DESK = ['general_manager', 'manager', 'front_desk'];

// Everyone who has a calendar to write on: the gym's classes for management
// and trainers, and everyone's own private diary - the front desk included
const CLASSES = ['general_manager', 'manager', 'trainer', 'instructor', 'coach', 'front_desk'];

// Coaching members: the coaches themselves, and management who assign them
const COACHING = ['general_manager', 'manager', 'trainer', 'instructor', 'coach'];

module.exports = {
  ALL, OWNER, MANAGEMENT, DESK, CLASSES, COACHING,
  only: (...groups) => requireRole(...groups.flat()),
};
