"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function createEmployeeAccount(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const branch_id = formData.get("branch_id") as string;

  if (!email || !password || !branch_id) {
    return { success: false, error: "Faltan campos obligatorios." };
  }

  // 1. Inicializar Cliente Máximo de Supabase (Poderes de Dios)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    return { success: false, error: "La llave de servicio no está configurada en el servidor." };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 2. Crear cuenta sin verificar correo y sin alterar sesión actual
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirmar
    });

    if (authError) throw authError;

    if (authData.user) {
      // 3. Modificar el perfil para asignarlo directamente a la Sede solicitada
      // Esperamos un momento chico por si el Trigger de la DB no ha terminado
      await new Promise((r) => setTimeout(r, 500));

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ branch_id: branch_id })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;
    }

    revalidatePath("/admin/sedes");
    return { success: true };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
