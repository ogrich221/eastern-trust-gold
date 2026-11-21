CREATE POLICY "Recipients view incoming transfer requests"
  ON public.customer_transfer_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_user_id);

CREATE INDEX IF NOT EXISTS customer_transfer_requests_recipient_idx
  ON public.customer_transfer_requests (recipient_user_id, status, created_at DESC);