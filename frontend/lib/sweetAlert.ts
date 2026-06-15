import Swal from "sweetalert2";

const base = {
  background: "#0f1419",
  color: "#e2e8f0",
  confirmButtonColor: "#0d9488",
  cancelButtonColor: "#334155",
  customClass: {
    popup: "trustai-swal-popup",
    title: "trustai-swal-title",
    htmlContainer: "trustai-swal-text",
    input: "trustai-swal-input",
    validationMessage: "trustai-swal-validation",
    confirmButton: "trustai-swal-confirm",
    cancelButton: "trustai-swal-cancel",
  },
  buttonsStyling: true,
  showClass: { popup: "swal2-show" },
  hideClass: { popup: "swal2-hide" },
};

export async function showInfo(title: string, text?: string): Promise<void> {
  await Swal.fire({
    ...base,
    icon: "info",
    title,
    text,
    confirmButtonText: "OK",
  });
}

export async function showSuccess(title: string, text?: string): Promise<void> {
  await Swal.fire({
    ...base,
    icon: "success",
    title,
    text,
    confirmButtonText: "OK",
  });
}

export async function showError(title: string, text?: string): Promise<void> {
  await Swal.fire({
    ...base,
    icon: "error",
    title,
    text,
    confirmButtonText: "OK",
  });
}

export async function confirmAction(options: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: "warning" | "question";
}): Promise<boolean> {
  const result = await Swal.fire({
    ...base,
    icon: options.icon ?? "question",
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Confirm",
    cancelButtonText: options.cancelText ?? "Cancel",
    reverseButtons: true,
  });
  return result.isConfirmed;
}

export async function promptText(options: {
  title: string;
  text?: string;
  inputValue?: string;
  placeholder?: string;
  inputType?: "text" | "textarea";
  required?: boolean;
  minLength?: number;
  confirmText?: string;
  cancelText?: string;
}): Promise<string | null> {
  const result = await Swal.fire({
    ...base,
    title: options.title,
    text: options.text,
    input: options.inputType ?? "text",
    inputValue: options.inputValue ?? "",
    inputPlaceholder: options.placeholder,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Submit",
    cancelButtonText: options.cancelText ?? "Cancel",
    reverseButtons: true,
    inputValidator: (value: string) => {
      const trimmed = value.trim();
      if (options.required !== false && !trimmed) {
        return "This field is required";
      }
      if (options.minLength && trimmed.length < options.minLength) {
        return `Please enter at least ${options.minLength} characters`;
      }
      return undefined;
    },
  });

  if (!result.isConfirmed) return null;
  return String(result.value ?? "").trim();
}

export async function promptNumber(options: {
  title: string;
  text?: string;
  inputValue?: string | number;
  allowNegative?: boolean;
  allowZero?: boolean;
  confirmText?: string;
  cancelText?: string;
}): Promise<number | null> {
  const result = await Swal.fire({
    ...base,
    title: options.title,
    text: options.text,
    input: "number",
    inputValue: String(options.inputValue ?? ""),
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Submit",
    cancelButtonText: options.cancelText ?? "Cancel",
    reverseButtons: true,
    inputValidator: (value: string) => {
      const amount = parseInt(value, 10);
      if (Number.isNaN(amount)) return "Enter a valid number";
      if (!options.allowZero && amount === 0) return "Amount cannot be zero";
      if (!options.allowNegative && amount < 0) return "Enter a positive number";
      return undefined;
    },
  });

  if (!result.isConfirmed) return null;
  return parseInt(String(result.value), 10);
}
