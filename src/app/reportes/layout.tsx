import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function ReportesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // No bloqueamos a empleados porque ellos pueden acceder para ver las ventas de su propia sede.
  // La RLS de Supabase filtra qué datos devuelven basándose en su branch_id.

  return <>{children}</>;
}
