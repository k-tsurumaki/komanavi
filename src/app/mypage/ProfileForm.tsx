"use client";

import { useState, useEffect } from "react";
import { User } from "next-auth";

interface ProfileFormProps {
    user: User;
}

interface UserProfile {
    displayName?: string;
    birthDate?: string; // Form uses string YYYY-MM-DD
    gender?: string;
    occupation?: string;
    nationality?: string;
    location?: string;
    visualTraits?: string;
    personality?: string;
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [profile, setProfile] = useState<UserProfile>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch("/api/user/profile");
                if (!res.ok) {
                    throw new Error("Failed to fetch profile");
                }

                const data = await res.json();

                // Handle birthDate: API returns ISO string or null.
                // Input type="date" needs YYYY-MM-DD.
                let birthDateStr = "";
                if (data.birthDate) {
                    // Assuming ISO string "YYYY-MM-DDTHH:mm:ss.sssZ"
                    birthDateStr = data.birthDate.split("T")[0];
                }

                setProfile({
                    displayName: data.displayName || "",
                    birthDate: birthDateStr,
                    gender: data.gender || "",
                    occupation: data.occupation || "",
                    nationality: data.nationality || "日本",
                    location: data.location || "",
                    visualTraits: data.visualTraits || "",
                    personality: data.personality || "",
                });
            } catch (error) {
                console.error("Error fetching profile:", error);
                setMessage({ type: "error", text: "プロフィールの取得に失敗しました。" });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []); // Remove dependency on user.id as auth is handled by cookies/session in API

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setProfile((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(profile),
            });

            if (!res.ok) {
                throw new Error("Failed to save profile");
            }

            setMessage({ type: "success", text: "プロフィールを保存しました。" });
        } catch (error) {
            console.error("Error saving profile:", error);
            setMessage({ type: "error", text: "保存に失敗しました。" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center py-8">読み込み中...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Myページ</h2>

            {message && (
                <div
                    className={`p-4 mb-6 rounded-md ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                >
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                        名前（表示名）
                    </label>
                    <input
                        type="text"
                        id="displayName"
                        name="displayName"
                        value={profile.displayName || ""}
                        onChange={handleChange}
                        placeholder="例：山田 太郎"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">漫画の主人公名として使用されます。</p>
                </div>

                {/* Birth Date */}
                <div>
                    <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">
                        生年月日
                    </label>
                    <input
                        type="date"
                        id="birthDate"
                        name="birthDate"
                        value={profile.birthDate || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Gender */}
                <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                        性別
                    </label>
                    <select
                        id="gender"
                        name="gender"
                        value={profile.gender || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">選択してください</option>
                        <option value="男性">男性</option>
                        <option value="女性">女性</option>
                        <option value="その他">その他</option>
                        <option value="無回答">無回答</option>
                    </select>
                </div>

                {/* Occupation */}
                <div>
                    <label htmlFor="occupation" className="block text-sm font-medium text-gray-700 mb-1">
                        職業
                    </label>
                    <input
                        type="text"
                        id="occupation"
                        name="occupation"
                        value={profile.occupation || ""}
                        onChange={handleChange}
                        placeholder="例：会社員、学生"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Nationality */}
                <div>
                    <label htmlFor="nationality" className="block text-sm font-medium text-gray-700 mb-1">
                        国籍
                    </label>
                    <select
                        id="nationality"
                        name="nationality"
                        value={profile.nationality || "日本"}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="日本">日本</option>
                        <option value="アメリカ">アメリカ</option>
                        <option value="イギリス">イギリス</option>
                        <option value="中国">中国</option>
                        <option value="韓国">韓国</option>
                        <option value="フランス">フランス</option>
                        <option value="ドイツ">ドイツ</option>
                        <option value="その他">その他</option>
                    </select>
                </div>

                {/* Location */}
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                        居住地
                    </label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        value={profile.location || ""}
                        onChange={handleChange}
                        placeholder="例：東京都"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">都道府県・国レベルで入力してください。</p>
                </div>

                {/* Visual Traits */}
                <div>
                    <label htmlFor="visualTraits" className="block text-sm font-medium text-gray-700 mb-1">
                        外見の特徴
                    </label>
                    <textarea
                        id="visualTraits"
                        name="visualTraits"
                        value={profile.visualTraits || ""}
                        onChange={handleChange}
                        rows={3}
                        placeholder="例：黒髪ショートヘア、眼鏡をかけている"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Personality */}
                <div>
                    <label htmlFor="personality" className="block text-sm font-medium text-gray-700 mb-1">
                        性格・口調
                    </label>
                    <textarea
                        id="personality"
                        name="personality"
                        value={profile.personality || ""}
                        onChange={handleChange}
                        rows={3}
                        placeholder="例：冷静沈着、丁寧語で話す"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-4">
                        入力された情報は漫画生成のキャラクター設定にのみ使用されます。<br />
                        すべての項目は任意です。
                    </p>
                    <button
                        type="submit"
                        disabled={saving}
                        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${saving ? "opacity-75 cursor-not-allowed" : ""
                            }`}
                    >
                        {saving ? "保存中..." : "保存する"}
                    </button>
                </div>
            </form>
        </div>
    );
}
