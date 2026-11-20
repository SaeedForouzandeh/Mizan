# Mizan Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Strict Store Isolation (PII & Ledger Privacy)**: Every document under `/users/{userId}` and its subcollections (`products`, `batches`, `sales`, `contacts`, `adjustments`) is strictly private to the authenticated, email-verified user whose `request.auth.uid == userId` and `ownerId == request.auth.uid`. No blanket `isSignedIn()` read or list is permitted anywhere.
2. **Master Gate Relational Integrity**: Subcollection creates (`batches`, `sales`, `adjustments`) verify via `exists()` that the parent store profile `/users/{userId}` and referenced `/users/{userId}/products/{productId}` exist.
3. **Immutable Ownership & Timestamps**: `ownerId` and `createdAt` cannot be modified after creation. `createdAt == request.time` on create; `updatedAt == request.time` on create/update.
4. **Terminal State Locking on Sales**: Once a sale has `status == 'voided'`, no further updates are permitted. Only transition `completed -> voided` is allowed on sale updates.
5. **Strict Schema & Volumetric Guards**: Every string checks `.size()`, every document enforces `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update, and `consumedBatches` is strictly bounded (`size() <= 25`).
6. **Path ID Hardening**: All single-document path IDs (`userId`, `productId`, `batchId`, `saleId`, `contactId`, `adjustmentId`) are validated with `isValidId()` (`^[a-zA-Z0-9_\-]+$`, `size() <= 128`).

## 2. The "Dirty Dozen" Malicious Payloads (All Must Yield PERMISSION_DENIED)

1. **Cross-Tenant PII Read**: User B attempts `get` on `/users/userA/contacts/c1` -> DENIED.
2. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts to create `/users/userA/products/p1` -> DENIED.
3. **Owner Spoofing**: User A attempts to create `/users/userA/products/p1` with `ownerId: "userB"` -> DENIED.
4. **Shadow Field Injection**: User A creates `/users/userA/products/p1` with extra ghost field `isAdmin: true` -> DENIED (`hasOnly` check).
5. **Path ID Poisoning**: User A writes to `/users/userA/products/bad$$id!@#` or 200-char ID -> DENIED (`isValidId`).
6. **Value Poisoning on Update**: User A updates `/users/userA/products/p1` setting `sellPrice: "free"` or `name` of 500 chars -> DENIED (`isValidProduct`).
7. **Immutable Field Tampering**: User A updates `/users/userA/products/p1` changing `createdAt` or `ownerId` -> DENIED.
8. **Orphan Batch Creation**: User A creates `/users/userA/batches/b1` referencing non-existent `productId: "ghost_prod"` -> DENIED (`exists` parent check).
9. **Terminal State Reversal**: User A attempts to update a `voided` sale back to `status: "completed"` -> DENIED (`existing().status == 'completed'`).
10. **Unbounded Array Flood**: User A creates a sale with 30 entries in `consumedBatches` -> DENIED (`size() <= 25`).
11. **Client Timestamp Forgery**: User A creates `/users/userA/contacts/c1` with a past `createdAt` instead of `request.time` -> DENIED.
12. **Blanket List Scraping**: User B queries `list` on `/users/userA/sales` -> DENIED (`resource.data.ownerId == request.auth.uid` and `isOwner(userId)`).
