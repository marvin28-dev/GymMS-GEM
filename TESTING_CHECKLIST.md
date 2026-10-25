# GEM — Full Testing Guide

Step-by-step instructions for every test. Do them in order — later tests depend on data created in earlier ones.

**Before you begin:**
1. Start the backend: `cd gem-backend && npm run dev`
2. Start the frontend: `cd gem-frontend && npm run dev`
3. Open browser to `http://localhost:5173`
4. Clear localStorage: open DevTools (F12) → Application → Local Storage → right-click → Clear

---

## 1. REGISTRATION & ONBOARDING

### TEST 1.1 — Welcome screen loads
1. Go to `http://localhost:5173/signup`
2. **Verify:** You see the welcome screen with "7-Day Free Trial" badge, a pricing card showing "250 FCFA / active member / month", four feature bullets, and a "Start free trial" button
3. Click "Start free trial"
4. **Verify:** You advance to Step 1 (Gym Setup) with a step indicator showing 3 dots at the top

### TEST 1.2 — Gym code auto-generates from name
1. In the "Gym Name" field, type `Power Fitness Douala`
2. **Verify:** The "Gym Code" field below auto-fills with `power-fitness-douala`
3. **Verify:** After ~1 second, a green "✓ Available" label appears to the right inside the code field

### TEST 1.3 — Gym code availability check (taken)
1. Clear the gym code field and manually type `elite` (the seed gym)
2. **Verify:** After ~1 second, a red "✗ Already taken" label appears

### TEST 1.4 — Regenerate code button
1. Type `Elite Fitness` in the gym name field (code auto-fills as `elite-fitness`)
2. Click the circular refresh (↻) button next to the code field
3. **Verify:** The code changes to something like `elite-fitness-47` (random suffix appended)

### TEST 1.5 — Manual code editing
1. Click inside the gym code field and clear it
2. Type `my-custom-gym`
3. **Verify:** The code stays as `my-custom-gym` (auto-generation stops once you edit manually)
4. **Verify:** Green "✓ Available" appears after the check

### TEST 1.6 — Step 1 validation (empty fields)
1. Clear both gym name and gym code fields
2. Click "Continue"
3. **Verify:** Error message appears under gym name: "Gym name is required"
4. **Verify:** Error message appears under gym code: "Gym code is required"

### TEST 1.7 — Step 1 validation (invalid code characters)
1. Type `Test Gym` for the name
2. In the code field, try typing `My Gym!` with uppercase and special chars
3. **Verify:** Only lowercase letters, numbers, and hyphens are accepted (uppercase and special chars are stripped as you type)

### TEST 1.8 — Advance to Step 2
1. Type `Test Gym Checklist` for gym name (code auto-fills)
2. Optionally fill Location and Phone
3. Click "Continue"
4. **Verify:** You advance to Step 2. The step indicator shows step 1 as completed (green checkmark) and step 2 as active (gold)

### TEST 1.9 — Step 2 validation
1. Leave all fields empty and click "Launch GEM"
2. **Verify:** Errors appear: "Required" under first name, last name; "Valid email is required" under email; "At least 8 characters" under password

### TEST 1.10 — Password mismatch
1. Fill first name: `John`, last name: `Manager`, email: `john@test.com`
2. Type password: `password123`
3. Type confirm password: `password456`
4. Click "Launch GEM"
5. **Verify:** Error under confirm password: "Passwords do not match"

### TEST 1.11 — Password show/hide toggle
1. Type something in the password field
2. Click the eye icon to the right of the password field
3. **Verify:** Password becomes visible (plain text)
4. Click the eye icon again
5. **Verify:** Password is masked again (dots)
6. Repeat for the confirm password field

### TEST 1.12 — Successful registration
1. Fill: First name `John`, Last name `Manager`, Email `john@testgym.com`, Password `password123`, Confirm `password123`
2. Click "Launch GEM"
3. **Verify:** Button text changes to "Creating workspace…" and is disabled while loading
4. **Verify:** Step 3 (Success) appears with a green checkmark circle

### TEST 1.13 — Manager security code displayed
1. On the success screen after registration
2. **Verify:** A red-bordered box at the top shows "⚠️ Important — Note this down now"
3. **Verify:** The 4-digit manager security code is displayed in large red text (e.g., `4821`)
4. **Verify:** Below it says "You can view this code again anytime from your Staff Profile"
5. **Write down this code** — you will need it later for manager PIN tests

### TEST 1.14 — Gym code displayed
1. On the same success screen
2. **Verify:** Below the security code, a card shows "Your Gym Code" with the code in gold monospace text
3. **Verify:** It says "Share this with your staff — they'll need it to sign in"

### TEST 1.15 — Navigate to dashboard
1. Click "Go to Dashboard"
2. **Verify:** You are taken to `/dashboard` and see the main dashboard with sidebar, header, and KPI cards

### TEST 1.16 — "Already have an account" link
1. Log out (or clear localStorage and go to `/signup`)
2. **Verify:** Top-right shows "Already have an account? Sign In"
3. Click it
4. **Verify:** You navigate to `/login` (GymCodePage)

### TEST 1.17 — Duplicate gym code error
1. Go to `/signup`, advance to Step 1
2. Type any gym name, then manually set the code to `elite`
3. Advance to Step 2, fill all fields, click "Launch GEM"
4. **Verify:** Error message appears: "Gym code already taken"

---

## 2. GYM CODE LOGIN

### TEST 2.1 — Valid gym code lookup
1. Go to `http://localhost:5173/login`
2. Type `elite` in the gym code field
3. Click "Continue" (or press Enter)
4. **Verify:** You navigate to `/elite/login` showing the gym login form

### TEST 2.2 — Invalid gym code
1. Go to `/login`
2. Type `nonexistent-gym` and press Enter
3. **Verify:** An error message appears (e.g., "Gym not found")

### TEST 2.3 — Demo gym section
1. On the `/login` page
2. **Verify:** Below the code input, there is a demo section showing "Elite Fitness Club · Yaoundé, Cameroon"
3. Click on the demo gym card
4. **Verify:** You navigate to `/elite/login`

---

## 3. STAFF LOGIN

### TEST 3.1 — Login with valid credentials
1. On `/elite/login`, type email: `marvin@elite.cm`, password: `admin123`
2. Click "Sign In"
3. **Verify:** You are redirected to `/dashboard`
4. **Verify:** The sidebar and header show your name

### TEST 3.2 — Login with wrong password
1. On `/elite/login`, type email: `marvin@elite.cm`, password: `wrongpass`
2. Click "Sign In"
3. **Verify:** Error message: "Invalid credentials"

### TEST 3.3 — Login with non-existent email
1. Type email: `nobody@elite.cm`, password: `admin123`
2. Click "Sign In"
3. **Verify:** Error message: "Invalid credentials"

### TEST 3.4 — Demo account cards (auto-fill)
1. On `/elite/login`
2. **Verify:** You see 3 demo account cards: General Manager (Marvin), Front Desk (Sandrine), Trainer (Michel)
3. Click the "General Manager" card
4. **Verify:** Email and password fields auto-fill with `marvin@elite.cm` and `admin123`
5. Click "Sign In"
6. **Verify:** Login succeeds

### TEST 3.5 — Password show/hide on login
1. On the login page, type something in the password field
2. Click the eye icon
3. **Verify:** Password becomes visible
4. Click again → hidden

---

## 4. DAILY RE-LOGIN

### TEST 4.1 — Same-day navigation works
1. Log in to the system
2. Click through several pages: Members, Staff, Payments, Settings
3. **Verify:** All pages load normally, no redirect to login

### TEST 4.2 — Next-day redirect
1. Log in to the system
2. Open DevTools (F12) → Console
3. Type: `localStorage.setItem('gem_auth', JSON.stringify({...JSON.parse(localStorage.getItem('gem_auth')), loginDate: '2020-01-01'}))`
4. Press Enter
5. Navigate to any page (e.g., click "Members" in sidebar)
6. **Verify:** You are immediately redirected to the login page
7. **Verify:** No flash of the dashboard before redirect

### TEST 4.3 — Root path when expired
1. After TEST 4.2 (auth expired), go to `http://localhost:5173/`
2. **Verify:** You see the landing page, NOT the dashboard

---

## 5. INACTIVITY TIMEOUT

### TEST 5.1 — Warning appears after inactivity
1. Log in to the system
2. Open DevTools Console and type: `localStorage.setItem('gem_last_activity', String(Date.now() - 6*60*1000))` (sets activity to 6 minutes ago)
3. Wait up to 10 seconds (the poll interval)
4. **Verify:** A modal appears saying "Are you still there?" with a countdown starting at 30

### TEST 5.2 — Countdown visual changes
1. When the warning modal is showing
2. **Verify:** The countdown number is gold/amber colored
3. Wait until it reaches 10
4. **Verify:** The number turns red, the progress bar turns red, the top border turns red

### TEST 5.3 — "Yes, I'm still here" dismisses warning
1. When the warning modal is showing
2. Click "Yes, I'm still here"
3. **Verify:** The modal disappears
4. **Verify:** You remain on the same page, still logged in
5. **Verify:** Normal mouse/keyboard activity prevents the warning from appearing again

### TEST 5.4 — "Log out" button
1. Trigger the warning again (repeat TEST 5.1)
2. Click "Log out"
3. **Verify:** You are immediately redirected to `/login`
4. **Verify:** LocalStorage `gem_auth` is cleared (check in DevTools)

### TEST 5.5 — Auto-logout at zero
1. Trigger the warning (repeat TEST 5.1)
2. Do NOT click anything — let the countdown reach 0
3. **Verify:** At exactly 0, you are automatically redirected to `/login`

### TEST 5.6 — Demo mode exempt
1. Log in as demo (gym code `elite`)
2. Open Console: `localStorage.setItem('gem_demo_mode', '1')`
3. Set old activity: `localStorage.setItem('gem_last_activity', String(Date.now() - 60*60*1000))`
4. Wait 15 seconds
5. **Verify:** No warning modal appears (demo mode is exempt)

---

## 6. MANAGER PIN VERIFICATION

### TEST 6.1 — Deactivate requires PIN
1. Log in as General Manager
2. Go to Staff page → click any staff member to open their profile
3. Click "Deactivate"
4. **Verify:** A modal appears asking for manager password/PIN
5. Type the wrong password (e.g., `wrong`)
6. **Verify:** Authorization denied
7. Type the correct password (`admin123`)
8. **Verify:** Staff member is deactivated, status changes to "Inactive"

### TEST 6.2 — Reactivate requires PIN
1. On the same staff profile (now inactive)
2. **Verify:** A green "Reactivate" button appears
3. Click "Reactivate"
4. **Verify:** Manager auth modal appears
5. Enter correct password → staff is reactivated, status changes to "Active"

### TEST 6.3 — View access code requires PIN
1. On any staff profile, find the "4-Digit Access Code" section
2. Click the eye icon to reveal the code
3. **Verify:** Manager auth modal appears
4. Enter correct password
5. **Verify:** The 4-digit code is revealed (e.g., `1234`)
6. Wait 30 seconds
7. **Verify:** The code auto-hides back to dots/hidden

### TEST 6.4 — Change salary requires PIN
1. On a staff profile, go to Pay & Earnings tab
2. Click to edit the salary
3. **Verify:** Manager auth modal appears
4. Enter correct password → salary field becomes editable

---

## 7. DASHBOARD

### TEST 7.1 — KPI cards display
1. Log in and go to `/dashboard`
2. **Verify:** You see cards for Active Members, Revenue, Pending Payments, etc.
3. **Verify:** Numbers are formatted with commas and FCFA suffix

### TEST 7.2 — KPI cards navigate
1. Click the "Active Members" KPI card
2. **Verify:** You navigate to `/members`
3. Go back to dashboard
4. Click "Payments" card → **Verify:** navigates to `/payments`

### TEST 7.3 — Calendar section
1. On the dashboard, find the calendar widget
2. Click the right arrow to go to tomorrow
3. **Verify:** The date label changes
4. Click "Week" or "Month" toggle
5. **Verify:** View changes accordingly

### TEST 7.4 — Quick actions
1. Find the Quick Actions section on the dashboard
2. Click "Add Member"
3. **Verify:** The Add Member modal opens
4. Close it (click X or Cancel)

### TEST 7.5 — Notification bell
1. Look at the header bar, find the bell icon
2. **Verify:** If there are unread notifications, a number badge appears
3. Click the bell
4. **Verify:** You navigate to `/notifications`

---

## 8. MEMBERS

### TEST 8.1 — Members table loads
1. Go to `/members`
2. **Verify:** A table shows with columns: Name, Phone, Email, Status, Package, etc.
3. **Verify:** Each member row has a status badge with the correct color

### TEST 8.2 — Member tabs
1. Click "Active" tab
2. **Verify:** Only active/expiring members shown
3. Click "Inactive" tab
4. **Verify:** Only suspended/frozen/expired/deactivated members shown
5. Click "Visitors" tab
6. **Verify:** Only visitors shown
7. Click "All Members" tab
8. **Verify:** All non-visitor members shown

### TEST 8.3 — Search members
1. Type a member's name in the search bar (e.g., `Armand`)
2. **Verify:** Table filters to show only matching members
3. Clear the search
4. **Verify:** All members show again

### TEST 8.4 — Add new member
1. Click "+ Add Member" button (top right)
2. **Verify:** Modal opens with section headers: Profile Photo, Personal Information, Address, Emergency Contact, Membership, Registration Fee, Additional Info
3. Fill required fields:
   - First Name: `Test`, Last Name: `Member`
   - Gender: `Male`
   - Email: `test@member.com`, Phone: `+237 699999999`
   - Street: `Test Street`, City: `Douala`
   - Emergency Contact: `Parent`, Emergency Phone: `+237 688888888`
   - Select a package from the dropdown
   - How Heard: `Friend`
4. Click "Create Member"
5. **Verify:** You are navigated to the new member's profile page
6. **Verify:** The member's name, code (GEM-XXXX), and status badge are visible

### TEST 8.5 — Duplicate email error
1. Go back to Members and click "+ Add Member" again
2. Fill required fields with the SAME email: `test@member.com`
3. Click "Create Member"
4. **Verify:** Error appears: "A member with this email already exists"

### TEST 8.6 — Package auto-calculates end date
1. In the Add Member modal, select a package (e.g., "Monthly")
2. **Verify:** The "End Date" field auto-fills (start date + package duration)
3. Change the start date to a different date
4. **Verify:** End date recalculates

### TEST 8.7 — Photo upload
1. In the Add Member modal, click the photo circle at the top
2. Select an image file from your computer
3. **Verify:** A preview of the photo appears in the circle

### TEST 8.8 — Add visitor
1. On the Members page, find the "Add Visitor" or equivalent button
2. Fill out the visitor form with name, phone, email
3. Select a visitor session bundle
4. Fill in payment amount (at least the minimum upfront %)
5. Submit
6. **Verify:** Visitor created, appears in the Visitors tab
7. **Verify:** Passes remaining matches the bundle's session count

### TEST 8.9 — Member profile page
1. Click on any member row in the table
2. **Verify:** You navigate to `/members/:id`
3. **Verify:** Profile card shows name, photo/avatar, member code, status badge, package name
4. **Verify:** Tabs are visible: Overview, Check-in History, Payment History, etc.

### TEST 8.10 — Edit member
1. On a member profile, click "Edit" or the edit button
2. **Verify:** Edit modal opens with all fields pre-filled
3. Change the phone number to something different
4. Click Save
5. **Verify:** The phone number updates on the profile

### TEST 8.11 — Status auto-correction (Pending → Active)
1. Add a new member with a start date of TODAY
2. **Verify:** Status shows "Active"
3. Add another member with a start date of TOMORROW
4. **Verify:** Status shows "Pending"
5. (Next day, or after changing system date) Navigate to `/members`
6. **Verify:** That pending member is now "Active"

### TEST 8.12 — Status auto-correction (Active → Expiring → Expired)
1. Add a member with an end date 5 days from now
2. **Verify:** Status shows "Expiring" (within 7-day window)
3. Add a member with an end date yesterday
4. Go to `/members` (or refresh)
5. **Verify:** That member's status auto-corrects to "Expired"

---

## 9. ATTENDANCE & CHECK-IN

### TEST 9.1 — Check in active member
1. Go to `/attendance` or use the Dashboard quick action
2. Find the check-in input/button
3. Enter an active member's access code (or search by name)
4. Click "Check In"
5. **Verify:** Success message with member name and photo
6. **Verify:** A new row appears in the attendance log

### TEST 9.2 — Check in expired member (blocked)
1. Find a member with "Expired" status (or manually set a member's endDate to the past)
2. Try to check them in
3. **Verify:** Error message appears explaining the member is expired

### TEST 9.3 — Visitor check-in (pass decrements)
1. Find a visitor with passes remaining (e.g., 5 passes)
2. Check them in using their access code
3. **Verify:** Check-in succeeds
4. **Verify:** Passes remaining decreases by 1 (now 4)

### TEST 9.4 — Visitor with 0 passes (blocked)
1. Find or create a visitor with 0 passes remaining
2. Try to check them in
3. **Verify:** Error message: "No passes remaining"

### TEST 9.5 — Attendance page filters
1. Go to `/attendance`
2. Use the date filter to select today
3. **Verify:** Only today's check-ins show
4. Switch to a different date
5. **Verify:** Records change accordingly
6. Use the search bar to filter by member name
7. **Verify:** Only matching records show

---

## 10. STAFF

### TEST 10.1 — Staff table loads
1. Go to `/staff`
2. **Verify:** Table shows staff with Name, Phone, Email, Role, Department, Status, Join Date

### TEST 10.2 — Add new staff
1. Click "+ Add Staff"
2. **Verify:** Modal opens with sections: Profile Photo, Personal Information, Employment Details, Access & Status, Emergency Contact, Documents & Notes
3. **Verify:** Status and Login Access Level are on the SAME row
4. Fill required fields: First Name: `New`, Last Name: `Trainer`, Phone: `+237 677777777`, Email: `trainer@test.com`, Role: `Trainer`
5. Click "Add Staff"
6. **Verify:** You navigate to the new staff member's profile page
7. **Verify:** The staff member appears with their role and department

### TEST 10.3 — Staff profile tabs
1. On a staff profile page
2. Click "Details" tab → **Verify:** all info fields shown with values
3. Click "Tasks Assigned" tab → **Verify:** task list (may be empty)
4. Click "Schedule" tab → **Verify:** weekly schedule grid shown
5. Click "Pay & Earnings" tab → **Verify:** salary and paystub area shown
6. Click "Notes" tab → **Verify:** notes list with add button

### TEST 10.4 — Edit staff profile
1. Click "Edit Profile" on a staff profile
2. **Verify:** Modal opens with all fields pre-filled
3. **Verify:** "Emergency Contact Information" section header is visible
4. **Verify:** Emergency Contact Name and Phone Number fields are side by side
5. Change the department to "Fitness"
6. Click Save
7. **Verify:** Department updates on the profile page

### TEST 10.5 — Access code reveal
1. On a staff profile, find "4-Digit Access Code"
2. Click the eye icon
3. **Verify:** Manager auth modal appears
4. Enter manager password (`admin123`)
5. **Verify:** Code is revealed (4 digits in gold)
6. **Verify:** A message says "auto-hides in 30s"
7. Wait 30 seconds
8. **Verify:** Code hides again

### TEST 10.6 — Staff duplicate email
1. Click "+ Add Staff" on the Staff page
2. Use the same email as an existing staff member
3. Submit the form
4. **Verify:** Error: "A staff member with this email already exists"

---

## 11. PAYMENTS

### TEST 11.1 — Payments table loads
1. Go to `/payments`
2. **Verify:** Table shows columns: Date, Member, Amount, Method, Reference, Balance After, Staff

### TEST 11.2 — Record a payment
1. On a member profile, click "Pay" or "Add Payment"
2. **Verify:** If the member owes money, you see an outstanding balance banner in red
3. Enter amount: `5000`
4. Select method: `Cash`
5. **Verify:** Reference auto-generated (TXN-XXX-XXX format)
6. **Verify:** Balance preview shows the new remaining balance
7. Click "Save Payment"
8. **Verify:** Payment created, appears in the member's payment history

### TEST 11.3 — Pay in Full shortcut
1. Open payment modal for a member with a balance (e.g., 25,000 FCFA)
2. Click "Pay in Full" button
3. **Verify:** Amount field auto-fills with the full balance (25000)
4. **Verify:** Balance preview shows 0

### TEST 11.4 — Registration fee does NOT reduce balance
1. Open payment modal for a member
2. Note the current balance
3. Select type: "Registration Fee"
4. Enter amount: `5000`, click Save
5. **Verify:** Payment created, but member balance stays the same (not reduced)

### TEST 11.5 — Payment method filter
1. On `/payments` page
2. Use the method filter dropdown, select "Cash"
3. **Verify:** Only cash payments shown
4. Select "Card"
5. **Verify:** Only card payments shown

---

## 12. PACKAGES

### TEST 12.1 — Packages page loads
1. Go to `/packages`
2. **Verify:** List of packages shown with name, price, duration, status

### TEST 12.2 — Add a package
1. Click "Add Package" (or equivalent button)
2. Fill: Name: `Premium Monthly`, Price: `30000`, Duration: 30 days (or 1 Month)
3. Submit
4. **Verify:** Package appears in the list

### TEST 12.3 — Duplicate package name
1. Try to add another package with the same name `Premium Monthly`
2. **Verify:** Error: "A package with this name already exists"

### TEST 12.4 — Edit package
1. Click edit on an existing package
2. Change the price
3. Save
4. **Verify:** Price updates in the list

### TEST 12.5 — Delete package
1. Click delete on a package
2. **Verify:** Confirmation dialog appears
3. Confirm
4. **Verify:** Package removed from list

---

## 13. SALES & PRODUCTS

### TEST 13.1 — Product grid display
1. Go to `/sales` or the Front Desk product tab
2. **Verify:** Products shown in a grid with name, price, stock count
3. **Verify:** Category filter tabs work (All, Drinks, Supplements, Gear, etc.)

### TEST 13.2 — Add to cart
1. Click "Add" (or +) on any product
2. **Verify:** Product appears in the cart panel
3. **Verify:** Cart shows item name, quantity (1), and line total

### TEST 13.3 — Cart quantity controls
1. In the cart, click + to increase quantity
2. **Verify:** Quantity increases, total updates
3. Click - to decrease
4. **Verify:** Quantity decreases, total updates

### TEST 13.4 — Checkout a sale
1. Add 1-2 products to the cart
2. Select payment method (e.g., Cash)
3. Click "Checkout" or "Complete Sale"
4. **Verify:** Sale processes, success message
5. **Verify:** Product stock decreases by the quantity sold

### TEST 13.5 — Insufficient stock
1. Try to sell more of a product than its current stock
2. **Verify:** Error about insufficient stock

---

## 14. TASKS

### TEST 14.1 — Task list loads
1. Go to `/tasks`
2. **Verify:** Tasks shown with Title, Assignee, Priority, Status, Due Date

### TEST 14.2 — Create a task
1. Click "+ New Task" (or equivalent)
2. Fill: Title: `Clean equipment`, Assign to: a staff member, Priority: `High`, Due: tomorrow
3. Submit
4. **Verify:** Task appears in the list with red "High" badge

### TEST 14.3 — Change task status
1. Find a task with status "Pending"
2. Change it to "In Progress"
3. **Verify:** Badge color changes (gold/yellow)
4. Change to "Done"
5. **Verify:** Badge turns green

### TEST 14.4 — Delete task
1. Click delete on a task
2. **Verify:** Confirmation dialog
3. Confirm → **Verify:** Task removed from list

---

## 15. CALENDAR

### TEST 15.1 — Calendar views
1. Go to `/calendar`
2. **Verify:** Default view shows (Day, Week, or Month)
3. Toggle to "Day" → **Verify:** Vertical timeline for one day
4. Toggle to "Week" → **Verify:** 7 columns for the week
5. Toggle to "Month" → **Verify:** Traditional calendar grid

### TEST 15.2 — Create event
1. Click on a date/time slot (or a "+ Add" button)
2. Fill: Title: `Morning Yoga`, Time: `07:00`, Duration: 1 hour, Instructor: pick a staff member
3. Save
4. **Verify:** Event appears on the calendar at the correct date/time

### TEST 15.3 — Edit / delete event
1. Click on an existing event
2. Change the title or time
3. Save → **Verify:** Changes reflected on calendar
4. Delete the event → **Verify:** It disappears from the calendar

---

## 16. ACCOUNTING & REPORTS

### TEST 16.1 — Revenue overview
1. Go to `/accounting`
2. **Verify:** Revenue KPIs visible (total, this month, etc.)
3. **Verify:** Amounts formatted with commas and FCFA

### TEST 16.2 — Add an expense
1. Find the "Add Expense" button
2. Fill: Title: `Electricity Bill`, Category: `Utilities`, Amount: `50000`, Date: today, Paid To: `ENEO`, Method: `Bank Transfer`
3. Submit
4. **Verify:** Expense appears in the expense list
5. **Verify:** Expense total updates

### TEST 16.3 — Expense category breakdown
1. On the accounting page, find the expense breakdown section
2. **Verify:** Categories shown (Utilities, Maintenance, Salaries, etc.)
3. **Verify:** Amounts per category reflect recorded expenses

### TEST 16.4 — Date range filter
1. Change the date range (e.g., "This Month" vs "Last 3 Months")
2. **Verify:** Revenue and expense figures update accordingly

---

## 17. OPERATIONS & EQUIPMENT

### TEST 17.1 — Report equipment issue
1. Go to `/operations`
2. Find the "Report Issue" button
3. Fill: Equipment: `Treadmill #3`, Description: `Belt is slipping`, Severity: `High`
4. Submit
5. **Verify:** Issue appears in the list with "High" severity badge and "Open" status

### TEST 17.2 — Update issue status
1. Find the issue you just created
2. Change status from "Open" to "In Progress"
3. **Verify:** Status badge updates
4. Change to "Resolved"
5. **Verify:** Status shows green "Resolved"

---

## 18. FRONT DESK KIOSK

### TEST 18.1 — Front desk login
1. Go to `http://localhost:5173/front-desk`
2. **Verify:** Fullscreen layout (no sidebar, no header)
3. **Verify:** Staff selection screen appears
4. Select your staff name (e.g., Marvin Ekokobe)
5. Enter your 4-digit access code
6. **Verify:** You enter the front desk interface

### TEST 18.2 — Wrong PIN
1. On the front desk login, select a staff name
2. Enter an incorrect PIN (e.g., `0000`)
3. **Verify:** Error message appears

### TEST 18.3 — Check-in tab
1. Inside the front desk, you should be on the Check-in tab
2. Type a member name in the search (e.g., `Armand`)
3. **Verify:** Member appears in search results with name, photo, status
4. Click to check in
5. **Verify:** Success confirmation with member name

### TEST 18.4 — Sign Up tab
1. Click the "Sign Up" tab in the front desk
2. **Verify:** You see options for New Member and New Visitor
3. Click "New Visitor"
4. **Verify:** A quick registration form appears
5. Fill out the visitor info and submit
6. **Verify:** Visitor created successfully

### TEST 18.5 — Product Sale tab
1. Click the "Products" or "Product Sale" tab
2. **Verify:** Product grid with category filters
3. Add a product to cart, checkout
4. **Verify:** Sale processes

### TEST 18.6 — Operations tab
1. Click the "Operations" tab
2. **Verify:** Today's live KPIs visible (check-ins, sales, revenue)
3. **Verify:** Quick action buttons available (report issue, log expense, etc.)

### TEST 18.7 — Exit front desk
1. Find the "Exit Front Desk" button (usually top-right)
2. Click it
3. **Verify:** PIN verification required to exit
4. Enter correct PIN
5. **Verify:** Session clears, you return to the login screen or main app

---

## 19. NOTIFICATIONS

### TEST 19.1 — Notification list loads
1. Go to `/notifications`
2. **Verify:** Notifications shown with icon, title, body, and time

### TEST 19.2 — Unread highlighting
1. **Verify:** Unread notifications have a gold background highlight and a dot indicator
2. **Verify:** The header shows the correct unread count

### TEST 19.3 — Category filters
1. Click "System" tab
2. **Verify:** Only system-type notifications shown
3. Click "Payment" tab
4. **Verify:** Only payment-type notifications shown
5. Click "All" tab
6. **Verify:** All notifications shown

### TEST 19.4 — Mark as read
1. Find an unread notification
2. Click "Mark read"
3. **Verify:** Gold highlight disappears from that notification
4. **Verify:** Unread count in header decreases by 1

### TEST 19.5 — Mark all as read
1. If there are multiple unread notifications
2. Click "Mark All as Read" button (top right)
3. **Verify:** All gold highlights disappear
4. **Verify:** Unread count goes to 0

### TEST 19.6 — Delete notification
1. Hover over a notification, click the trash icon
2. **Verify:** Notification is removed from the list

### TEST 19.7 — Click notification navigates
1. Find a "Finish your gym setup" notification (system type)
2. Click on it
3. **Verify:** You navigate to `/settings`
4. Go back to notifications
5. Find a "Payment Received" notification (if exists)
6. Click it
7. **Verify:** You navigate to `/payments`

### TEST 19.8 — Arrow icon on actionable notifications
1. Look at notifications that have a destination (system, payment, member types)
2. **Verify:** A small "›" arrow icon appears on the right side

### TEST 19.9 — Notification triggers
1. Go to `/members`, add a new member
2. Go to `/notifications`
3. **Verify:** A "New Member Joined" notification appeared
4. Go back, record a payment for any member
5. Check notifications
6. **Verify:** A "Payment Received" notification appeared
7. Go to Staff, add a new staff member
8. Check notifications
9. **Verify:** A "New Staff Member Added" notification appeared

### TEST 19.10 — Registration setup notifications
1. Register a brand new gym (follow TEST 1.12)
2. After landing on the dashboard, go to `/notifications`
3. **Verify:** Two notifications exist: "Finish your gym setup" and "Complete your gym profile"
4. **Verify:** Both are unread (gold highlight)

---

## 20. SETTINGS

### TEST 20.1 — Setup indicator dots (new gym only)
1. Register a new gym and log in
2. Go to `/settings`
3. **Verify:** Pulsing amber dots appear next to: Gym Profile, Payment Settings, Membership Defaults, Package Settings, Expense Management, Staff Roles
4. Click on "Payment Settings"
5. **Verify:** The dot on "Payment Settings" disappears (section marked as visited)
6. Click on "Staff Roles"
7. **Verify:** That dot disappears too

### TEST 20.2 — Gym Profile dot (data-driven)
1. In Settings, look at "Gym Profile" — the dot should be present if phone or email is empty
2. Click "Gym Profile", fill in Phone and Email
3. Click "Save Changes"
4. Navigate away from Settings and come back
5. **Verify:** The "Gym Profile" dot is gone (phone + email now filled)

### TEST 20.3 — Gym Profile save
1. Go to Settings → Gym Profile
2. Change the gym name to something different
3. Fill phone: `+237 699111222`, email: `info@mygym.com`
4. Click "Save Changes"
5. **Verify:** "Saved" confirmation appears
6. Refresh the page
7. **Verify:** The values are still there (persisted via API)

### TEST 20.4 — Appearance / Theme switch
1. Go to Settings → Appearance
2. **Verify:** 4 theme options visible: Obsidian, Ivory, Midnight, Forest (or similar)
3. Click "Ivory" (light theme)
4. **Verify:** The entire UI switches to light mode immediately
5. Refresh the page
6. **Verify:** Theme persists (still light)
7. Switch back to "Obsidian" (dark)
8. **Verify:** Dark mode returns

### TEST 20.5 — Language switch
1. Go to Settings → Language
2. Select "Français"
3. **Verify:** All UI labels switch to French (sidebar, page titles, buttons)
4. Navigate to Members page
5. **Verify:** Column headers are in French
6. Go back to Settings → Language, select "English"
7. **Verify:** Everything reverts to English

### TEST 20.6 - Payment Settings save
1. Go to Settings, Payment Settings
2. Uncheck "Credit/Debit Card" from accepted methods
3. Change the Front Desk Expense Limit to `20000`
4. Click "Save Changes"
5. **Verify:** "Saved" appears next to the button
6. Navigate away, then come back to Payment Settings
7. **Verify:** Card is unchecked and the limit shows 20000
8. Open Add Payment on a member. **Verify:** Card is not offered

### TEST 20.7 — Membership Defaults (Registration Fee)
1. Go to Settings → Membership Defaults
2. Find the "Registration Fee" section
3. Toggle the registration fee ON
4. Set amount to `5000`, frequency to "Yearly"
5. Click "Save Changes"
6. Refresh the page
7. **Verify:** Registration fee is still ON with amount 5000

### TEST 20.8 — Package Settings (Access Types)
1. Go to Settings → Package Settings
2. **Verify:** Default access types listed (Full Access, Gym Only, etc.)
3. In the "Add" input, type `VIP Lounge Access` and click "Add"
4. **Verify:** "VIP Lounge Access" appears as a chip
5. Click the X on "VIP Lounge Access"
6. **Verify:** It disappears from the list

### TEST 20.9 - Emails to members in French
1. Go to Settings, Language. Under "Emails to members", choose "Français"
2. Refresh the page. **Verify:** Français is still chosen
3. Record a payment for a member with an email address (a Resend test address or your own, see 25.4)
4. **Verify:** the receipt and its PDF are in French ("Reçu de paiement", "Espèces", the date as "25 octobre 2026")
5. Choose "English" again. **Verify:** the next email is in English

### TEST 20.10 - Settings on a phone
1. On a phone, open Settings
2. **Verify:** a list of sections, none open
3. Tap Gym Profile. **Verify:** its form opens directly under it, at the top of the screen
4. Tap Payment Settings, change a method and save. **Verify:** it saves as on a computer
5. Tap the open section again. **Verify:** it closes
6. **Verify:** no page is wider than the screen

There is no Staff Roles section: a role decides which pages someone may open, in the code (`utils/rolePages.js`).

---

## 21. SYSTEM TOUR

### TEST 21.1 — Tour auto-starts for new users
1. Register a completely new gym (new localStorage, no `gem_tour_seen`)
2. After landing on the dashboard
3. **Verify:** The tour overlay appears automatically after ~1 second
4. **Verify:** First card says "Welcome to GEM" with a blur background

### TEST 21.2 — Tour auto-starts for demo users
1. Clear localStorage, go to `/login`
2. Enter gym code `elite`, login as General Manager
3. **Verify:** Tour overlay appears (demo mode triggers tour)

### TEST 21.3 — Tour does NOT auto-start for returning users
1. Complete the tour (or close it) — this sets `gem_tour_seen = '1'`
2. Log out and log back in
3. **Verify:** Tour does NOT auto-start

### TEST 21.4 — Tour navigation (Next / Back)
1. Start the tour
2. Click "Next" (or the right button with the next step label)
3. **Verify:** Advances to next step, spotlight moves
4. Click "Back"
5. **Verify:** Goes back to previous step

### TEST 21.5 — Tour progress bar
1. During the tour, look at the progress bar (thin segments at the bottom of the card)
2. **Verify:** Current step is highlighted, completed steps are dimmer
3. Click on a different segment
4. **Verify:** Tour jumps to that step

### TEST 21.6 — Tour spotlight on sidebar
1. Navigate to the "Sidebar" step (step 2)
2. **Verify:** The sidebar is spotlighted (bright) while everything else is dimmed
3. **Verify:** A glowing colored ring appears around the sidebar

### TEST 21.7 — Tour navigates between pages
1. Advance to the "Members" step
2. **Verify:** Browser navigates to `/members`
3. **Verify:** Spotlight highlights the main content area
4. Advance to "Attendance" step
5. **Verify:** Browser navigates to `/attendance`

### TEST 21.8 — Tour Front Desk steps
1. Advance to the "Log in to the Front Desk" step
2. **Verify:** Browser navigates to `/front-desk`
3. **Verify:** Card explains the 4-digit security code login
4. Advance through Front Desk steps (FD Intro, Staff, Check-in, Recent, Sign Up, Products, Operations, Exit)
5. **Verify:** Each step switches the front desk to the correct tab
6. **Verify:** Spotlight highlights the correct panel for each step

### TEST 21.9 — Tour smooth transitions
1. Advance through several steps quickly
2. **Verify:** Spotlight smoothly animates from one element to another (no jumping)
3. **Verify:** Card opacity fades out then in during transitions
4. **Verify:** Card never appears at the wrong position before correcting itself

### TEST 21.10 — Tour card positioning
1. Go through steps with different spotlight positions
2. **Verify:** When the spotlight is on the left side, the card appears on the right
3. **Verify:** When the spotlight is at the top, the card appears at the bottom
4. **Verify:** The card never overlaps the spotlighted element

### TEST 21.11 — Skip / Close tour
1. During the tour, click "Skip tour" at the bottom of the card
2. **Verify:** Tour closes, overlay disappears
3. **Verify:** You remain on whatever page you were on

### TEST 21.12 — Replay button
1. After closing/completing the tour, look at the bottom-right of any page
2. **Verify:** A small sparkle (✦) button is visible
3. Hover over it
4. **Verify:** It expands to show "Replay tour" (or "Take the tour" if first time)
5. Click it
6. **Verify:** Tour restarts from step 1

### TEST 21.13 — Tour "Done" step
1. Advance through ALL steps until the last one
2. **Verify:** Final card says "You're all set!" with a green checkmark
3. Click "Explore now"
4. **Verify:** Tour closes, you land on `/dashboard`

---

## 22. BILINGUAL (EN/FR)

### TEST 22.1 — Switch to French
1. Go to Settings → Language → select "Français"
2. Go to `/members`
3. **Verify:** Page title in French, column headers in French
4. Go to `/staff`
5. **Verify:** Add Staff button in French, form labels in French
6. Go to Dashboard
7. **Verify:** KPI labels, quick actions in French

### TEST 22.2 — Switch back to English
1. Go to Settings → Language → select "English"
2. Navigate through the same pages
3. **Verify:** Everything is back in English

---

## 23. EDGE CASES

### TEST 23.1 — Empty states
1. Log in to a brand-new gym with no data
2. Go to `/members` → **Verify:** "No members" empty state
3. Go to `/payments` → **Verify:** Empty table or "No payments" message
4. Go to `/tasks` → **Verify:** Empty state
5. Go to `/notifications` → **Verify:** "All caught up!" if no notifications, or only the 2 setup ones

### TEST 23.2 — Member balance never negative
1. Create a member with balance: 5000
2. Record a payment of 10000
3. **Verify:** Balance becomes 0 (not -5000)

### TEST 23.3 — Visitor passes never negative
1. Create a visitor with 1 pass
2. Check them in (passes goes to 0)
3. Try to check in again
4. **Verify:** Error, passes stay at 0 (never goes to -1)

### TEST 23.4 — Multi-tab logout
1. Open the app in Tab A (logged in)
2. Open the app in Tab B (same session, also logged in)
3. In Tab B, log out
4. In Tab A, click any link (e.g., Members)
5. **Verify:** Tab A redirects to login (auth was cleared from localStorage)

### TEST 23.5 — API error handling
1. Stop the backend server (Ctrl+C in the terminal)
2. Try to navigate to `/members` (or any data page)
3. **Verify:** An error message appears (not a blank page or crash)
4. Start the backend again
5. Refresh
6. **Verify:** Data loads normally

### TEST 23.6 — Form survives server error
1. Open the Add Member modal and fill out several fields
2. Disconnect the backend (stop the server)
3. Click Submit
4. **Verify:** Error message appears
5. **Verify:** Your form data is still there (fields not cleared)
6. Restart backend, click Submit again
7. **Verify:** Member created successfully

---

## 24. PERFORMANCE

### TEST 24.1 — Dashboard load time
1. Open DevTools → Network tab
2. Navigate to `/dashboard`
3. **Verify:** Page fully renders in under 2 seconds

### TEST 24.2 — Search responsiveness
1. On the Members page with multiple members
2. Type in the search bar
3. **Verify:** Results filter in under 500ms (feels instant)

### TEST 24.3 — Theme switch speed
1. Go to Settings → Appearance
2. Click a different theme
3. **Verify:** Colors change instantly (no flash of unstyled content)

### TEST 24.4 — Modal transitions
1. Open any modal (Add Member, Payment, etc.)
2. **Verify:** Modal animates in smoothly
3. Close it
4. **Verify:** Closes smoothly (no jank)

### TEST 24.5 — Tour transition smoothness
1. Start the system tour
2. Rapidly click Next through 5+ steps
3. **Verify:** Spotlight and card transitions are smooth
4. **Verify:** No visual glitches, overlapping cards, or stuck overlays

---

## 25. CHECKS ONLY A PERSON CAN MAKE (production audit, October 2026)

The automated tests cover every journey in Chromium, Firefox and WebKit, and
the phone layouts on emulated phones (see `AUDIT_PROGRESS.md`, section 3a).
These checks need real devices, real inboxes or a real person.

### TEST 25.1 - A real iPhone (Safari)
1. On an iPhone, open the gym's sign-in page and sign in as the owner.
2. Add a member, taking the photo with the camera.
3. Open the front desk and check a member in with the keypad.
4. Pick a date and a time in a form (the date box and the time list).
5. Download a payment receipt and a payslip as PDF.
6. **Verify:** nothing is cut off or wider than the screen, the keyboard never covers the box being typed in, the PDFs open.

### TEST 25.2 - A real Android phone (Chrome)
1. Repeat 25.1 on an Android phone.
2. Type an amount in any money box.
3. **Verify:** the number keyboard opens and only digits go in.
4. Pinch-zoom a page. **Verify:** it zooms (D-49), and tapping a form box does not zoom in on its own.

### TEST 25.3 - Safari on a Mac
1. Sign in, add a payment, open the end-of-day report and print it.
2. **Verify:** everything works as in Chrome.

### TEST 25.4 - Email reaching real inboxes
Only once a sending domain is verified in Resend and `EMAIL_FROM_ADDRESS` is set.
1. Record a payment for a member whose email is your own Gmail address; repeat with Outlook and Yahoo addresses you own.
2. **Verify:** the receipt arrives within a minute, not in spam, with the PDF attached and readable.
3. Open it on a phone's mail app. **Verify:** the layout fits, accents (é, è) and the currency read correctly.
4. Send a password reset to yourself. **Verify:** the link opens the reset page and works once.
5. Register a new gym with your own address. **Verify:** the "Confirm your email address" link arrives, opens GEM and the reminder in the app goes away (D-8).
6. In Settings, Language, choose Français for "Emails to members" and record a payment. **Verify:** the receipt and its PDF arrive in French, accents intact (D-23).

### TEST 25.5 - Text messages
Texting is paused. When it is switched on:
1. Set `SMS_PROVIDER=log` first and send a message to one member. **Verify:** it appears in the server log.
2. Switch to Twilio and send one text to a staff phone. **Verify:** it arrives with the gym's name as sender.

### TEST 25.6 - Printing on a real printer
1. Print the end-of-day report, a payment receipt and the members export from Chrome, Firefox and Safari.
2. **Verify:** one clean page per document, nothing cut at the edges, French text intact.

### TEST 25.7 - A screen reader
1. Windows: NVDA with Firefox. iPhone: VoiceOver.
2. Sign in, open Members, open a row's actions menu, add a payment, make a form error on purpose.
3. **Verify:** each field is read with its name, a dialog is announced with its title, the error is read out, and the row menu can be used with the arrow keys.

### TEST 25.8 - A slow connection
1. In Chrome's developer tools, set the network to "Slow 4G" and empty the cache.
2. Open the app, then Members, then the front desk.
3. **Verify:** each page shows its frame (sidebar, header) at once and its content when it arrives; nothing looks frozen.

### TEST 25.9 - Two desks at once
1. Open the front desk on one computer and the member's profile on another.
2. Take a payment on one. **Verify:** the other shows it within a few seconds, without a reload.

### TEST 25.10 - A tab left open across a deploy
1. Open the app, leave the tab open, and deploy a new version.
2. In the old tab, open a page you had not opened before.
3. **Verify:** either the page opens, or the "Something went wrong" screen offers Reload and Reload works.

### TEST 25.11 - The first deploy with migrations (D-1, D-4)
1. Back up the production database first (Railway, the Postgres service, Backups; or `pg_dump`).
2. In Railway, check the backend service uses `gem-backend/railway.json` (its root directory is `gem-backend`, or the config path points to the file).
3. Deploy.
4. **Verify:** the pre-deploy log shows `node scripts/migrate.js` recognising the database and applying the new migrations (or saying there is nothing to apply), and the server starts.
5. **Verify:** the demo gym "elite" was not created or reset, and existing gyms, members and payments are untouched.
6. If the pre-deploy step refuses the database (it matches no known state), nothing was changed: keep the backup and send the log.

### TEST 25.12 - A deploy while a desk is working (F-180)
1. Open the front desk, and the member list on a second computer.
2. Deploy a new version of the backend on Railway.
3. **Verify:** the old server's log says "SIGTERM: finishing the requests under way, then stopping"; both screens carry on without a reload, and a payment taken on one shows on the other within a few seconds of the new server starting.
4. On Railway, open the service's health check (`/api/health`). **Verify:** it answers `{"status":"ok"}`.

### TEST 25.13 - The web app's security headers (D-45)
1. Open a Vercel preview of the web app in Chrome, with the developer tools on the Network tab, and reload.
2. Click the first request (the page). **Verify:** its response headers include `Content-Security-Policy` (with `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `Permissions-Policy`.
3. Use the app: sign in, open a member with a photo, upload a photo, open a staff ID and click Download, open the front desk.
4. **Verify:** the Console shows no "Content Security Policy" errors, and the photos and the ID download work. If photos are not on Cloudinary, set `VITE_PHOTO_HOST` to their host and build again.

### TEST 25.14 - The tests on GitHub (D-12)
1. After the first push of this branch, open the repository's Actions tab.
2. **Verify:** the workflow runs lint, unit and API tests on its own PostgreSQL, and the Chromium and Firefox browser jobs, and all pass.
