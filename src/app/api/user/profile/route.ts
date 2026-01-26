import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function GET() {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminFirestore();

    try {
        const docRef = db.collection("users").doc(session.user.id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            // Convert Timestamp to ISO string if needed, or send as is.
            // Firebase Admin returns Timestamps. Serializing to JSON automatically converts them to strings usually, 
            // but let's be explicit if needed. For now, sending data directly.
            // Note: Firestore Timestamps usually serialize to object { _seconds, _nanoseconds } in Admin SDK direct JSON response,
            // or ISO strings depending on configuration. Let's simplify efficiently.

            // We need to handle Timestamp conversion for the frontend
            const responseData: any = { ...data };
            if (responseData.birthDate && typeof responseData.birthDate.toDate === 'function') {
                responseData.birthDate = responseData.birthDate.toDate().toISOString();
            }
            if (responseData.updatedAt && typeof responseData.updatedAt.toDate === 'function') {
                responseData.updatedAt = responseData.updatedAt.toDate().toISOString();
            }

            return NextResponse.json(responseData);
        } else {
            // Return empty profile with default nationality
            return NextResponse.json({ nationality: "日本" });
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const db = getAdminFirestore();

        // Basic validation could go here

        const docRef = db.collection("users").doc(session.user.id);

        // Prepare data for saving
        const saveData: any = { ...body };

        // Handle birthDate conversion from string to Date/Timestamp
        if (saveData.birthDate) {
            saveData.birthDate = new Date(saveData.birthDate);
        } else {
            saveData.birthDate = null;
        }

        // Always update server timestamp
        saveData.updatedAt = new Date();

        await docRef.set(saveData, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
