import React, { useState } from 'react';
import { FileCode, Upload, Download, Plus, Trash2 } from 'lucide-react';

interface PartitionEditorToolProps {
  initialPartitions?: any[];
}

const PartitionEditorTool: React.FC<PartitionEditorToolProps> = ({ initialPartitions }) => {
  const [partitions, setPartitions] = useState<any[]>(initialPartitions || []);

  React.useEffect(() => {
    if (initialPartitions && initialPartitions.length > 0) {
      setPartitions(initialPartitions);
    }
  }, [initialPartitions]);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <FileCode className="mr-3 text-primary" />
            Partition Table Editor
          </h2>
          <div className="flex space-x-2">
            <button className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-sm flex items-center text-slate-700 dark:text-slate-200">
              <Upload size={16} className="mr-2" /> Import CSV
            </button>
            <button className="px-3 py-2 bg-primary hover:bg-primary-hover rounded-lg text-sm flex items-center">
              <Download size={16} className="mr-2" /> Export .bin
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
              <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase">
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Name</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Type</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">SubType</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Offset</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Size</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Flags</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50">
              {partitions.length > 0 ? partitions.map((p, idx) => (
                <tr key={idx} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/30">
                  <td className="p-2"><input type="text" value={p.label} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], label: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                  <td className="p-2"><input type="text" value={p.type} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], type: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                  <td className="p-2"><input type="text" value={p.subtype} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], subtype: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                  <td className="p-2 text-primary/80"><input type="text" value={p.offset} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], offset: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                  <td className="p-2 text-emerald-600 dark:text-green-300"><input type="text" value={p.size} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], size: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                  <td className="p-2"><input type="text" value={p.encrypted ? 'encrypted' : ''} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], encrypted: e.target.value === 'encrypted' }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                  <td className="p-2 text-center">
                    <button onClick={() => setPartitions(partitions.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                    No partitions loaded. Analyze a firmware file or import a CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setPartitions([...partitions, { label: 'new_part', type: 'data', subtype: 'nvs', offset: '', size: '0x1000', encrypted: false }])}
            className="w-full py-2 border border-dashed border-slate-400 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-slate-500 transition-all flex items-center justify-center"
          >
            <Plus size={16} className="mr-2" /> Add Partition
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartitionEditorTool;
