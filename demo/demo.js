// $ export LUOGU_TOKEN=xxxxx:yyyyyyyyy
// $ yarn build && node demo/demo.js

const { LuoguOpenApiClient } = require("..");
const client = new LuoguOpenApiClient(process.env.LUOGU_TOKEN, (trackId, data) => {
  console.log(trackId, data);
});

client.submit({
  pid: "P1001",
  lang: "cxx/20/gcc",
  o2: true,
  code: `
#include <cstdio>
#include <unistd.h>

int main() {
  int a, b;
  scanf("%d %d", &a, &b);
  sleep(1);
  printf("%d\\n", a + b);
  return 0;
}
`
});
