CREATE OR REPLACE FUNCTION public.set_transfer_pin(_pin_hash text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _pin_hash IS NULL OR length(_pin_hash) <> 64 THEN RAISE EXCEPTION 'INVALID_PIN'; END IF;
  INSERT INTO public.profiles (
    id, first_name, last_name, phone, address, city, postal_code,
    security_question_one, security_answer_one_hash,
    security_question_two, security_answer_two_hash,
    transfer_pin_hash
  )
  VALUES (
    auth.uid(), 'Account', 'Holder', '000-000-0000', 'Not provided', 'Not provided', '00000',
    'Not configured yet', repeat('0', 64),
    'Not configured yet', repeat('0', 64),
    _pin_hash
  )
  ON CONFLICT (id) DO UPDATE
    SET transfer_pin_hash = EXCLUDED.transfer_pin_hash,
        updated_at = now();
END $function$;