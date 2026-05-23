import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const fullName = process.argv[3]?.trim() || email;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
  console.error("Usage: npm run admin:grant:local -- <email> [full name]");
  process.exit(1);
}

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(targetEmail) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const found = data.users.find(
      (user) => user.email?.toLowerCase() === targetEmail,
    );

    if (found || data.users.length < 100) {
      return found ?? null;
    }

    page += 1;
  }
}

let user = await findUserByEmail(email);

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error) {
    throw error;
  }

  user = data.user;
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .upsert(
    {
      auth_user_id: user.id,
      email,
      full_name: fullName,
      approval_status: "approved",
      default_status: "resident",
    },
    { onConflict: "auth_user_id" },
  )
  .select("id")
  .single();

if (profileError) {
  throw profileError;
}

const { error: roleError } = await supabase.from("app_roles").upsert(
  {
    profile_id: profile.id,
    role: "admin",
  },
  { onConflict: "profile_id,role" },
);

if (roleError) {
  throw roleError;
}

console.log(`Granted admin role for ${email}.`);
