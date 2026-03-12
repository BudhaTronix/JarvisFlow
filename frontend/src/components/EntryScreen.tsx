import type { FormEvent } from "react";

interface EntryScreenProps {
  value: string;
  isLoading: boolean;
  error: string | null;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
}

export function EntryScreen({ value, isLoading, error, onChange, onSubmit }: EntryScreenProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <main className="entry-shell">
      <section className="entry-card">
        <p className="eyebrow">Gesture-Controlled Brainstorming</p>
        <h1>JARVIS Flow</h1>
        <p className="entry-copy">
          Enter a word or a group of words to start brainstorming
        </p>
        <form className="entry-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="topic-input">
            Root topic
          </label>
          <input
            id="topic-input"
            className="topic-input"
            type="text"
            placeholder="Try: space farming, biotech, climate design"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <button className="submit-button" type="submit" disabled={isLoading}>
            {isLoading ? "Loading..." : "Start Flow"}
          </button>
        </form>
        <p className="entry-note">
          Leave it blank to explore the built-in Biology phase-1 dataset.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}
