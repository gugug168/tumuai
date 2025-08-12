/*
  # Fix RLS policy for tool submissions

  1. Security Changes
    - Update RLS policy on `tool_submissions` table to allow public INSERT operations
    - Ensure anonymous users can submit tools for review
    - Maintain security for other operations (SELECT, UPDATE, DELETE remain admin-only)
*/

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Anyone can submit tools" ON tool_submissions;

-- Create new policy that allows public INSERT operations
CREATE POLICY "Public can submit tools"
  ON tool_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure the existing admin policy for managing submissions is still in place
-- This policy should already exist from previous migrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tool_submissions' 
    AND policyname = 'Admins can manage submissions'
  ) THEN
    CREATE POLICY "Admins can manage submissions"
      ON tool_submissions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users au 
          WHERE au.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admin_users au 
          WHERE au.user_id = auth.uid()
        )
      );
  END IF;
END $$;