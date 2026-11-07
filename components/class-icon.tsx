import {
  BookOpen,
  Users,
  GraduationCap,
  Leaf,
  Sparkles,
  Pencil,
  FileText,
  LayoutGrid,
  FolderOpen,
  Clock,
} from "./animated-icons";
import type { ClassRoom } from "@/lib/model";

export const classIcons = [
  { value: "book", label: "Livro", Icon: BookOpen },
  { value: "users", label: "Pessoas", Icon: Users },
  { value: "graduation", label: "Formação", Icon: GraduationCap },
  { value: "science", label: "Ideias", Icon: Leaf },
  { value: "sparkles", label: "Estrelas", Icon: Sparkles },
  { value: "pencil", label: "Lápis", Icon: Pencil },
  { value: "activity", label: "Atividades", Icon: FileText },
  { value: "geometry", label: "Geometria", Icon: LayoutGrid },
  { value: "projects", label: "Projetos", Icon: FolderOpen },
  { value: "time", label: "Tempo", Icon: Clock },
] as const;
export function ClassIcon({
  icon,
  size = 28,
}: {
  icon?: ClassRoom["icon"];
  size?: number;
}) {
  const Icon = (classIcons.find((item) => item.value === icon) ?? classIcons[0])
    .Icon;
  return <Icon size={size} />;
}
export function ClassIconPicker({
  value = "book",
  onChange,
}: {
  value?: ClassRoom["icon"];
  onChange: (value: NonNullable<ClassRoom["icon"]>) => void;
}) {
  return (
    <fieldset className="class-icon-picker">
      <legend>Ícone da turma</legend>
      {classIcons.map(({ value: key, label, Icon }) => (
        <label key={key}>
          <input
            type="radio"
            name="icon"
            value={key}
            checked={key === value}
            onChange={() => onChange(key)}
          />
          <span>
            <Icon size={24} />
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
