import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/use-auth';
import { SANDBOX_RAZORPAY_KEY_ID } from '@/features/appointments/api';
import { CheckoutDismissedError, payWithRazorpay } from '@/features/appointments/razorpay';
import { ApiError } from '@/lib/api-client';
import {
  HOME_VISIT_DETAIL_KEY,
  HOME_VISIT_MINE_KEY,
  homeVisitsApi,
  type HomeVisitRequest,
} from './api';

export function useHomeVisitPayment() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (visit: HomeVisitRequest) => {
      if (!visit.checkout) return visit;
      if (visit.checkout.keyId === SANDBOX_RAZORPAY_KEY_ID) {
        return homeVisitsApi.confirmSandboxPayment(visit.id);
      }
      const confirmation = await payWithRazorpay(visit.checkout, {
        description: 'Doctor at home visit',
        name: user?.fullName,
        email: user?.email,
      });
      return homeVisitsApi.confirmPayment(visit.id, confirmation);
    },
    onSuccess: (_data, visit) => {
      void queryClient.invalidateQueries({ queryKey: HOME_VISIT_MINE_KEY });
      void queryClient.invalidateQueries({ queryKey: HOME_VISIT_DETAIL_KEY(visit.id) });
    },
  });
}

export function homeVisitPaymentErrorMessage(error: unknown): string {
  if (error instanceof CheckoutDismissedError) {
    return 'Payment was not completed. You can pay below while your doctor’s acceptance is held.';
  }
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong with the payment.';
}
