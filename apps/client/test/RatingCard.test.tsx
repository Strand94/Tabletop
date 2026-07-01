import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RatingCard } from '../src/components/RatingCard.js';

describe('RatingCard', () => {
  it('shows "not rated" when value is null and no stars', () => {
    render(<RatingCard label="Din vurdering" value={null} />);
    expect(screen.getByText('Ikke vurdert ennå')).toBeInTheDocument();
  });

  it('renders the numeric value', () => {
    render(<RatingCard label="Din vurdering" value={8.6} />);
    expect(screen.getByText('8.6')).toBeInTheDocument();
  });

  it('edits and saves a rating via the slider', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RatingCard label="Din vurdering" value={null} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vurder' }));
    const slider = screen.getByRole('slider', { name: 'Din vurdering' });
    fireEvent.change(slider, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(9));
  });
});
