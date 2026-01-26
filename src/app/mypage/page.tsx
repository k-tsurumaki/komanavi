import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

export default async function MyPage() {
    const session = await auth();

    if (!session || !session.user) {
        redirect("/login");
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 border-b pb-4">
                アカウント設定
            </h1>
            <ProfileForm user={session.user} />
        </div>
    );
}
