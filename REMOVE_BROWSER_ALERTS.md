# Remove Browser Alerts - Implementation Plan

## Files to Update:

### 1. **Dashboard.tsx**
- Line 295: `alert('You have already completed this round...')`
- **Fix**: Add state `showAlert` and replace with `<AlertDialog>`

### 2. **TeamDetail.tsx** (Admin)
- Lines 156, 165, 172, 177, 198, 207, 214, 219: Multiple `alert()` calls for reset feedback
- **Fix**: Add `showAlert` state and custom `<AlertDialog>` component

### 3. **SnapshotManager.tsx** (Admin)
- Lines 79, 89, 118, 120: `alert()` for snapshot operations
- **Fix**: Add toast state instead of alerts

### 4. **Round4Monitor.tsx** (Admin)
- Line 114: `alert('Error extending time')`
- Line 122: `confirm('Are you sure...')`
- **Fix**: Add confirm dialog state

### 5. **QuizManager.tsx** (Admin)
- Lines 88, 102, 176, 370, 375, 381: `alert()` and `confirm()` for validation
- **Fix**: Add validation toast messages

### 6. **CipherChallenge.tsx**
- Lines 86, 87, 155: `alert()` for validation errors
- **Fix**: Add error state and show in-app error message

### 7. **TuringTestChallenge.tsx**
- Lines 175, 211: `alert()` for errors
- **Fix**: Add error toast

### 8. **PromptZipperChallenge.tsx**
- Line 151: `alert()` for error
- **Fix**: Add error toast

## Solution Pattern:

For each file:
1. Add state: `const [alertMsg, setAlertMsg] = useState<{message: string; variant: 'success'|'error'|'warning'} | null>(null);`
2. Replace `alert(msg)` with `setAlertMsg({message: msg, variant: 'info'})`
3. Add component at end of JSX:
```tsx
{alertMsg && <AlertDialog message={alertMsg.message} variant={alertMsg.variant} onClose={() => setAlertMsg(null)} />}
```

For `confirm()`:
1. Add state: `const [confirmDialog, setConfirmDialog] = useState<{message: string; onConfirm: () => void} | null>(null);`
2. Replace `if (!confirm(msg)) return;` with `setConfirmDialog({message: msg, onConfirm: () => doAction()})`
3. Add component:
```tsx
{confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
```

## Priority Order:
1. Dashboard.tsx (user-facing)
2. QuizManager.tsx (admin validation)
3. TeamDetail.tsx (admin reset feedback)
4. Challenge components (errors)
5. Other admin pages (lower priority)
