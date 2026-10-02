const fs = require('fs');
const path = require('path');

const dir1 = path.join('app', 'api', 'auth', '[...nextauth]');
const dir2 = path.join('app', 'api', 'auth', 'register');

fs.mkdirSync(dir1, { recursive: true });
fs.mkdirSync(dir2, { recursive: true });

const nextAuthCode = `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
`;

fs.writeFileSync(path.join(dir1, 'route.ts'), nextAuthCode);

if (fs.existsSync('app/api/route.ts')) {
  fs.copyFileSync('app/api/route.ts', path.join(dir2, 'route.ts'));
  fs.unlinkSync('app/api/route.ts');
}

console.log("SUCCESS: Auth and Register routes fixed!");
