const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

content = content.replace(
`  dipakaiOleh String?
  dipakaiAt   BigInt?`,
``
);

const tokenClaimModel = `
model TokenClaim {
  id        String @id @default(cuid())
  ujianId   String
  pesertaId String
  kode      String
  claimedAt BigInt

  ujian     Ujian @relation(fields: [ujianId], references: [id], onDelete: Cascade)
  peserta   User  @relation(fields: [pesertaId], references: [id], onDelete: Cascade)

  @@unique([ujianId, pesertaId])
}
`;

content = content.replace('model SesiUjian {', tokenClaimModel + '\nmodel SesiUjian {');

fs.writeFileSync('prisma/schema.prisma', content);
console.log("schema.prisma updated");
