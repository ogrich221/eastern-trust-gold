export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string
          admin_name: string
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          currency: string
          description: string
          id: string
          idempotency_key: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by_id: string | null
          reverses_id: string | null
          status: string
          transaction_date: string
          txn_type: string
          user_id: string
        }
        Insert: {
          account_id: string
          admin_name: string
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          currency: string
          description: string
          id?: string
          idempotency_key: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by_id?: string | null
          reverses_id?: string | null
          status?: string
          transaction_date?: string
          txn_type: string
          user_id: string
        }
        Update: {
          account_id?: string
          admin_name?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          currency?: string
          description?: string
          id?: string
          idempotency_key?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by_id?: string | null
          reverses_id?: string | null
          status?: string
          transaction_date?: string
          txn_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_reversed_by_id_fkey"
            columns: ["reversed_by_id"]
            isOneToOne: false
            referencedRelation: "account_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "account_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_type: string
          allow_overdraft: boolean
          available_balance: number
          created_at: string
          credit_limit: number | null
          currency: string
          current_balance: number
          id: string
          is_active: boolean
          last_four: string
          name: string
          user_id: string
        }
        Insert: {
          account_type: string
          allow_overdraft?: boolean
          available_balance?: number
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          last_four: string
          name: string
          user_id: string
        }
        Update: {
          account_type?: string
          allow_overdraft?: boolean
          available_balance?: number
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          last_four?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      international_wires: {
        Row: {
          account_id: string
          account_number: string
          amount: number
          country: string
          created_at: string
          currency: string
          id: string
          memo: string | null
          recipient_bank: string
          recipient_name: string
          status: string
          swift_bic: string
          txn_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_number: string
          amount: number
          country: string
          created_at?: string
          currency: string
          id?: string
          memo?: string | null
          recipient_bank: string
          recipient_name: string
          status?: string
          swift_bic: string
          txn_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_number?: string
          amount?: number
          country?: string
          created_at?: string
          currency?: string
          id?: string
          memo?: string | null
          recipient_bank?: string
          recipient_name?: string
          status?: string
          swift_bic?: string
          txn_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "international_wires_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "international_wires_txn_id_fkey"
            columns: ["txn_id"]
            isOneToOne: false
            referencedRelation: "account_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          avatar_url: string | null
          city: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          phone: string
          postal_code: string
          security_answer_one_hash: string
          security_answer_two_hash: string
          security_question_one: string
          security_question_two: string
          transfer_pin_hash: string | null
          updated_at: string
        }
        Insert: {
          address: string
          avatar_url?: string | null
          city: string
          created_at?: string
          first_name: string
          id: string
          last_name: string
          phone: string
          postal_code: string
          security_answer_one_hash: string
          security_answer_two_hash: string
          security_question_one: string
          security_question_two: string
          transfer_pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_url?: string | null
          city?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          postal_code?: string
          security_answer_one_hash?: string
          security_answer_two_hash?: string
          security_question_one?: string
          security_question_two?: string
          transfer_pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_edit_transaction_date: {
        Args: {
          _admin: string
          _reason: string
          _transaction_date: string
          _transaction_id: string
        }
        Returns: string
      }
      admin_post_transaction: {
        Args: {
          _account_id: string
          _admin: string
          _amount: number
          _currency: string
          _description: string
          _idempotency_key: string
          _reference: string
          _reversal_reason?: string
          _reverses?: string
          _type: string
        }
        Returns: string
      }
      admin_post_transaction_with_date: {
        Args: {
          _account_id: string
          _admin: string
          _amount: number
          _currency: string
          _description: string
          _idempotency_key: string
          _reference: string
          _reversal_reason?: string
          _reverses?: string
          _transaction_date?: string
          _type: string
        }
        Returns: string
      }
      customer_payment: {
        Args: {
          _amount: number
          _from: string
          _key: string
          _memo: string
          _payee: string
          _pin_hash?: string
        }
        Returns: string
      }
      customer_transfer: {
        Args: {
          _amount: number
          _from: string
          _key: string
          _memo: string
          _pin_hash?: string
          _to_account: string
          _to_email: string
        }
        Returns: string
      }
      customer_wire: {
        Args: {
          _account_number: string
          _amount: number
          _country: string
          _currency: string
          _from: string
          _key: string
          _memo: string
          _pin_hash?: string
          _recipient_bank: string
          _recipient_name: string
          _swift: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_transfer_pin: { Args: { _pin_hash: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
