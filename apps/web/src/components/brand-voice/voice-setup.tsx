import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus } from 'lucide-react'
import type { BrandTone, BrandVoice } from '@viralix/types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'

const TONES: { value: BrandTone; label: string; description: string; emoji: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Formal, expert, credible', emoji: '💼' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, approachable, human', emoji: '😊' },
  { value: 'bold', label: 'Bold', description: 'Confident, direct, powerful', emoji: '⚡' },
  { value: 'witty', label: 'Witty', description: 'Clever, humorous, playful', emoji: '🎭' },
  { value: 'inspirational', label: 'Inspirational', description: 'Motivating, uplifting, aspirational', emoji: '✨' },
  { value: 'authoritative', label: 'Authoritative', description: 'Commanding, trustworthy, expert', emoji: '🎯' },
  { value: 'conversational', label: 'Conversational', description: 'Casual, natural, relatable', emoji: '💬' },
  { value: 'luxurious', label: 'Luxurious', description: 'Premium, refined, exclusive', emoji: '👑' },
]

const schema = z.object({
  tone: z.string().min(1, 'Select a tone'),
  keywords: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
  sampleCopy: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default VoiceSetup

interface VoiceSetupProps {
  initialData?: Partial<BrandVoice>
  onSave?: (data: FormData) => void
  saving?: boolean
}

function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setInput('')
    }
  }

  const remove = (chip: string) => onChange(value.filter((v) => v !== chip))

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] p-2 min-h-[80px]">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((chip) => (
          <span
            key={chip}
            className="flex items-center gap-1 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-xs px-2 py-0.5 font-medium"
          >
            {chip}
            <button type="button" onClick={() => remove(chip)} className="hover:opacity-70 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))] transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function VoiceSetup({ initialData, onSave, saving }: VoiceSetupProps) {
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tone: initialData?.tone ?? '',
      keywords: initialData?.keywords ?? [],
      forbiddenWords: initialData?.forbiddenWords ?? [],
      sampleCopy: initialData?.sampleCopy ?? '',
    },
  })

  const selectedTone = watch('tone')

  return (
    <form onSubmit={handleSubmit((d) => onSave?.(d))} className="space-y-6">
      {/* Tone selector */}
      <div>
        <Label className="mb-3 block">Brand Tone</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TONES.map((tone) => (
            <button
              key={tone.value}
              type="button"
              onClick={() => setValue('tone', tone.value)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                selectedTone === tone.value
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(262,83%,58%,0.4)]',
              )}
            >
              <span className="text-xl block mb-1">{tone.emoji}</span>
              <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{tone.label}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{tone.description}</p>
            </button>
          ))}
        </div>
        {errors.tone && <p className="text-xs text-[hsl(var(--destructive))] mt-1">{errors.tone.message}</p>}
      </div>

      {/* Keywords */}
      <div>
        <Label className="mb-1.5 block">Brand Keywords</Label>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Words that should appear in your copy</p>
        <Controller
          control={control}
          name="keywords"
          render={({ field }) => (
            <ChipInput
              value={field.value}
              onChange={field.onChange}
              placeholder="Type a keyword and press Enter..."
            />
          )}
        />
      </div>

      {/* Forbidden words */}
      <div>
        <Label className="mb-1.5 block">Forbidden Words</Label>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Words to never use in your copy</p>
        <Controller
          control={control}
          name="forbiddenWords"
          render={({ field }) => (
            <ChipInput
              value={field.value}
              onChange={field.onChange}
              placeholder="Type a word and press Enter..."
            />
          )}
        />
      </div>

      {/* Sample copy */}
      <div>
        <Label className="mb-1.5 block">Sample Copy (optional)</Label>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Paste existing copy that exemplifies your brand voice</p>
        <Controller
          control={control}
          name="sampleCopy"
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Paste a sample ad, email, or social post that best represents your brand's tone..."
              rows={4}
            />
          )}
        />
      </div>

      <Button type="submit" loading={saving}>
        Save Brand Voice
      </Button>
    </form>
  )
}
