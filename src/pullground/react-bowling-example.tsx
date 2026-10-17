import { Pullground } from '@johnson7543/pullground';

export default function App() {
  async function handlePull() {
    // Run your action here.
  }

  return (
    <Pullground game="bowling" onPull={handlePull}>
      <main>Your content</main>
    </Pullground>
  );
}
