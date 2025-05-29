import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const uploadPresaleImage = async (
  file: File,
  presaleAddress: string
): Promise<string> => {
  try {
    // Validate file
    if (!file) throw new Error("No file provided");

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File size exceeds 2MB limit");
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      throw new Error(
        "Invalid file type. Only JPG, PNG, and WebP are supported"
      );
    }

    // Create a unique file name
    const fileExt = file.name.split(".").pop();
    const fileName = `${presaleAddress}.${fileExt}`;
    const filePath = `presale-images/${fileName}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("presale-images")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    // Get public URL
    // The getPublicUrl method is synchronous and returns the public URL directly in the data object.
    // It does not return an 'error' property in its result object.
    const { data: publicUrlObject } = supabase.storage
      .from("presale-images")
      .getPublicUrl(filePath);

    if (!publicUrlObject || !publicUrlObject.publicUrl) {
      throw new Error("Failed to construct public URL for the uploaded image.");
    }
    const imageUrl = publicUrlObject.publicUrl;
    const { error: dbError } = await supabase.from("presale_images").upsert({
      presale_address: presaleAddress,
      image_url: imageUrl,
    });

    if (dbError) throw dbError;

    return imageUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

export const getPresaleImage = async (
  presaleAddress: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("presale_images")
      .select("image_url")
      .eq("presale_address", presaleAddress)
      .maybeSingle(); // Use maybeSingle() instead of single()

    if (error && error.code !== "PGRST116") throw error; // Ignore "no rows" errors

    return data?.image_url || null;
  } catch (error) {
    console.error("Error getting presale image:", error);
    return null;
  }
};
