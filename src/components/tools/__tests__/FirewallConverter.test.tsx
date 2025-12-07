
// Logic extracted for easier testing
// Ideally this would be in a separate logic file, but for now we can duplicate logic or test via component interaction.
// We will test via component for now since the logic is embedded.

import { render, screen, fireEvent } from '@testing-library/react';
import { FirewallConverterTool } from '../FirewallConverterTool';
import { describe, it, expect } from 'vitest';

describe('FirewallConverterTool', () => {
    it('renders the converter UI', () => {
        render(<FirewallConverterTool />);
        expect(screen.getByText('Loot Sorter (Converter)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/192.168.1.1/)).toBeInTheDocument();
    });

    it('converts basic IP list to Ubiquiti JSON by default', () => {
        render(<FirewallConverterTool />);

        const input = screen.getByPlaceholderText(/192.168.1.1/);
        // The arrow button might not have a name, checking icon
        // Actually we can find button by role 'button' and check if it triggers convert.
        // There are multiple buttons possibly, so let's target the one with ArrowRight (which likely is the main action)
        // Or better, check the container structure.

        fireEvent.change(input, { target: { value: '1.1.1.1\n8.8.8.8' } });

        // Find the convert button (it's the one between input and output)
        const buttons = screen.getAllByRole('button');
        const convertButton = buttons.find(b => b.className.includes('bg-green-600')); // Heuristic based on styling
        if (!convertButton) throw new Error("Convert button not found");

        fireEvent.click(convertButton);

        const output = screen.getAllByRole('textbox')[1]; // Second textarea
        // The JSON.stringify(..., null, 4) adds spaces which breaks simple string matching if we aren't careful
        // The error shows: "address": [\n

        const val = output.getAttribute('value') || output.innerHTML || (output as HTMLTextAreaElement).value;
        expect(val).toContain('"address": [');
        expect(val).toContain('"1.1.1.1",');
        expect(val).toContain('"8.8.8.8"');
    });

    it('converts to Cisco ACL', () => {
        render(<FirewallConverterTool />);

        const input = screen.getByPlaceholderText(/192.168.1.1/);
        fireEvent.change(input, { target: { value: '10.0.0.1' } });

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'cisco' } });

        const buttons = screen.getAllByRole('button');
        const convertButton = buttons.find(b => b.className.includes('bg-green-600'));
        if (!convertButton) throw new Error("Convert button not found");
        fireEvent.click(convertButton);

        const output = screen.getAllByRole('textbox')[1];
        expect(output).toHaveValue('access-list 101 permit ip host 10.0.0.1 any');
    });
});
