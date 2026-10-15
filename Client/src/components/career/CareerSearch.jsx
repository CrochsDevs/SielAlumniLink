import { Button, TextField, Theme } from "@radix-ui/themes";
import { Search } from "lucide-react";
import "@radix-ui/themes/styles.css";

export default function CareerSearch({ value, onChange, onSearch, placeholder }) {
  return (
    <Theme asChild accentColor="green" grayColor="sage" radius="large" hasBackground={false}>
      <form
        role="search"
        aria-label="Career board search"
        className="career-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(value.trim());
        }}
      >
        <TextField.Root
          type="search"
          size="3"
          variant="surface"
          className="career-search"
          aria-label="Search career board"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        >
          <TextField.Slot side="left"><Search size={18} aria-hidden="true" /></TextField.Slot>
          <TextField.Slot side="right"><Button type="submit" size="2" radius="medium">Search</Button></TextField.Slot>
        </TextField.Root>
      </form>
    </Theme>
  );
}
