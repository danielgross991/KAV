import { createClient } from "@supabase/supabase-js";

const url = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = requiredEnvironmentVariable("SUPABASE_SECRET_KEY");
const email = requiredEnvironmentVariable("KAV_BOOTSTRAP_EMAIL").trim().toLowerCase();
const password = requiredEnvironmentVariable("KAV_BOOTSTRAP_PASSWORD");

if (!email.includes("@")) throw new Error("KAV_BOOTSTRAP_EMAIL must be a valid email address.");
if (password.length < 8) throw new Error("KAV_BOOTSTRAP_PASSWORD must contain at least 8 characters.");

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const user = await findExistingUser(email);
if (!user) throw new Error("No existing Auth user matches KAV_BOOTSTRAP_EMAIL.");

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
});
if (error) throw new Error(`Unable to configure Auth user: ${error.message}`);

console.log(`Configured Auth user ${user.email ?? email} (${user.id}).`);
console.log("User password configured successfully.");

async function findExistingUser(targetEmail) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Unable to list Auth users: ${error.message}`);

    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

function requiredEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
