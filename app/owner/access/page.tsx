import { redirect } from "next/navigation";

export default async function OwnerAccessPage() {
  redirect("/owner/access/admin-slots");
}
