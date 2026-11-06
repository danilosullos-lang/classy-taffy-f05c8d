import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

export interface AuthCredentials {
  email: string;
  password: string;
}

export async function signUpWithEmail(
  credentials: AuthCredentials,
  displayName: string
): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: credentials.email.trim(),
    password: credentials.password,
    options: { data: { display_name: displayName.trim() } }
  });

  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function signInWithEmail(
  credentials: AuthCredentials
): Promise<{ user: User; session: Session }> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password
  });

  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error("O Supabase não retornou uma sessão autenticada.");
  }
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}
