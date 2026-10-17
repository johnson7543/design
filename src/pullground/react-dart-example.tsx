import { Pullground } from '@johnson7543/pullground';

export default function App() {
  async function handlePull() {
    // Run your action here.
  }

  return (
    <Pullground game="dart" onPull={handlePull}>
      <main>Your content</main>
    </Pullground>
  );
}
