import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/use-auth';
import { doctorName } from '@/features/doctors/api';
import { ApiError } from '@/lib/api-client';
import { appointmentsApi, SANDBOX_RAZORPAY_KEY_ID, type PatientAppointment } from './api';
import { CheckoutDismissedError, payWithRazorpay } from './razorpay';

/** Opens Razorpay for a held booking, then has the server verify the payment. */
export function usePayment() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointment: PatientAppointment) => {
      if (!appointment.checkout) return appointment;
      if (appointment.checkout.keyId === SANDBOX_RAZORPAY_KEY_ID) {
        return appointmentsApi.confirmSandboxPayment(appointment.id);
      }
      const confirmation = await payWithRazorpay(appointment.checkout, {
        description: `Consultation with ${doctorName(appointment.doctor.displayName)}`,
        name: user?.fullName,
        email: user?.email,
      });
      return appointmentsApi.confirmPayment(appointment.id, confirmation);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
}

export function paymentErrorMessage(error: unknown): string {
  if (error instanceof CheckoutDismissedError) {
    return 'Payment was not completed. Your slot is held for a few minutes – you can pay below.';
  }
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong with the payment. If money left your account, it will be refunded.';
}
