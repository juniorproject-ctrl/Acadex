# Acadex SR1 Test Matrix

Run these against a configured MySQL database and the deployed service before recording a final pass.

| Area | Test | Expected result | Status |
| --- | --- | --- | --- |
| Registration | Valid student@sharjah.ac.ae | Account is created unverified and OTP is sent | Ready to test |
| Registration | Personal or malformed email | API rejects the request | Automated domain tests pass |
| Registration | Weak password | API rejects fewer than 8 characters or missing number/symbol | Ready to test |
| OTP | Correct code | Account is verified and JWT is issued | Ready to test |
| OTP | Incorrect, expired, or excessive code requests | Request is rejected | Ready to test |
| Login | Correct verified credentials | JWT session is issued | Ready to test |
| Login | Unverified account, invalid password, or rate limit | Request is rejected | Ready to test |
| Authorization | No JWT or expired JWT | Protected listing API rejects the request | Ready to test |
| Listings | Create, read, update, and delete | Data persists in MySQL and only owner can modify it | Ready to test |
| Drafts | Save, leave, then continue draft | Draft is server-side and is available after sign-in | Ready to test |
| Images | Upload JPG, PNG, WebP | Reference is stored with the listing and survives refresh | Ready to test |
| Browse | Search, filter, sort, page, browser Back | Results and URL state are restored correctly | Ready to test |
| Cross-device | Register on one device and login on another | Same account and listings are loaded from server | Ready to test |
