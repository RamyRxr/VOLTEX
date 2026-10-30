import { redirect } from "next/navigation";

/** The website is the doctor's dashboard only; patients use the mobile app. */
export default function Home() {
  redirect("/d");
}
