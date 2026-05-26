export const mockGym = {
  name: "Elite Fitness Club",
  location: "Shell Nsimeyong",
  currency: "XAF",
  registrationFee: 5000,
  registrationFeeRequired: true,
  registrationFeeFrequency: 'yearly',   // 'yearly' | 'one-time'
  registrationGracePeriodDays: 7,       // days after reg fee due before suspension kicks in
  minUpfrontPercent: 50,                // minimum % of membership fee due at registration
  paymentDeadlineDays: 30,              // days allowed to pay the remainder
  managerCode: '9721',                  // 4-digit authorization code for manager-level actions
  kpis: {
    totalMembers: { mtd: 1050, ytd: 11840 },
    totalRevenue: { mtd: 1040000, ytd: 23840000 },
    totalExpenditures: { mtd: 4300000, ytd: 17210000 },
  },
};

export const mockStaff = [
  { id: "S-1", name: "Stephen", role: "Manager" },
  { id: "S-2", name: "Linda", role: "Front Desk" },
  { id: "S-3", name: "Kevin", role: "Trainer" },
  { id: "S-4", name: "Myself", role: "Owner" },
];

export const mockTasksSeed = [
  {
    id: "T-1",
    title: "Approve Time Card",
    description: "Review submitted time card and approve if correct.",
    dueDate: "2025-01-07",
    assignedTo: "S-4",
    createdOn: "2024-12-21",
  },
  {
    id: "T-2",
    title: "Check Inventory",
    description: "Confirm supplement stock levels and reorder if needed.",
    dueDate: "2025-01-06",
    assignedTo: "S-1",
    createdOn: "2024-12-21",
  },
  {
    id: "T-3",
    title: "Check Hours",
    description: "Verify staff attendance hours for payroll.",
    dueDate: "2025-01-07",
    assignedTo: "S-4",
    createdOn: "2024-12-21",
  },
];
export const mockMembers = [
  {
    id: "m-001",
    firstName: "John",
    lastName: "Doe",
    phone: "+237 6xx xxx xxx",
    membership: "Monthly",
    status: "Active",
  },
  {
    id: "m-002",
    firstName: "Jane",
    lastName: "Smith",
    phone: "+237 6xx xxx xxx",
    membership: "Annual",
    status: "Frozen",
  },
];


export const mockNotificationsSeed = [];
