import { Search } from "lucide-react";

export default function CareerSearch({ value, onChange, onSearch, placeholder }) {
  return (
    <form
        role="search"
        aria-label="Career board search"
        className="career-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(value.trim());
        }}
      >
      <div className="career-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search career board"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
