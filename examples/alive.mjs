import { pid } from 'process';

function onTick() {
  // eslint-disable-next-line no-console
  console.log(pid);
  setTimeout(onTick, 500);
}
onTick();
