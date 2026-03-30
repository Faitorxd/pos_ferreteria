import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function ReportesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verificar si es admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    // Si no es admin, no tiene autorización para ver reportes
    redirect("/pos");
  }

  return <>{children}</>;
}
