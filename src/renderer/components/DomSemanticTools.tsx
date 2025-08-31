import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { useDomUtils } from '../hooks/useDomUtils';
import { RefreshCw } from 'lucide-react';

export function DomSemanticTools() {
  const { dom, semantic, isLoading, error, result } = useDomUtils();
  const { toast } = useToast();
  const [selector, setSelector] = useState('');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState('{}');
  const [tabs, setTabs] = useState<Array<{ id: string; title: string; url: string }>>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>('');

  // Load tabs on component mount
  useEffect(() => {
    const loadTabs = async () => {
      try {
        const tabsList = await dom.getTabs();
        setTabs(tabsList);
        if (tabsList.length > 0) {
          const activeTab = tabsList.find(tab => tab.id === selectedTabId) || tabsList[0];
          setSelectedTabId(activeTab.id);
        }
      } catch (error) {
        console.error('Failed to load tabs:', error);
      }
    };
    loadTabs();
  }, []);

  const handleError = (err: Error) => {
    console.error('Error:', err);
    toast({
      variant: 'destructive',
      title: 'Error',
      description: err.message,
    });
  };

  const handleSuccess = (data: any) => {
    console.log('Success:', data);
    toast({
      title: 'Success',
      description: 'Operation completed successfully',
    });
  };

  const handleDomAction = async (action: (tabId: string) => Promise<any>, requireTab = true) => {
    try {
      if (requireTab && !selectedTabId) {
        throw new Error('No tab selected');
      }
      const result = await action(selectedTabId);
      if (result?.success) {
        handleSuccess(result.data);
      } else {
        handleError(new Error(result?.error || 'Unknown error'));
      }
      return result;
    } catch (err) {
      handleError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const handleExtractElement = () => {
    if (!selector.trim()) {
      handleError(new Error('Please enter a CSS selector'));
      return;
    }
    handleDomAction((tabId: string) => dom.extractElement(selector, ['textContent', 'innerHTML'], tabId));
  };

  const handleExtractTable = () => {
    if (!selector.trim()) {
      handleError(new Error('Please enter a CSS selector'));
      return;
    }
    handleDomAction((tabId: string) => dom.extractTable(selector, JSON.parse(options), tabId));
  };

  const handleExtractImages = () => {
    handleDomAction((tabId: string) => 
      dom.extractImages(selector.trim() || undefined, JSON.parse(options), tabId)
    );
  };

  const handleExtractLinks = () => {
    handleDomAction((tabId: string) => 
      dom.extractLinks(selector.trim() || undefined, JSON.parse(options), tabId)
    );
  };

  const handleExtractMeta = () => {
    handleDomAction((tabId: string) => 
      dom.extractMeta(JSON.parse(options), tabId)
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>DOM Tools</CardTitle>
          <div className="flex items-center space-x-2">
            <select
              value={selectedTabId}
              onChange={(e) => setSelectedTabId(e.target.value)}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.title || tab.url}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const tabsList = await dom.getTabs();
                setTabs(tabsList);
              }}
              title="Refresh tabs"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardTitle>DOM & Semantic Tools</CardTitle>
        <CardDescription>Extract and analyze page content</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dom" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dom">DOM Tools</TabsTrigger>
            <TabsTrigger value="semantic">Semantic Tools</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dom" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selector">CSS Selector</Label>
              <Input
                id="selector"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="Enter CSS selector (e.g., .class, #id, tag)"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleExtractElement}
                disabled={isLoading}
              >
                Extract Element
              </Button>
              
              <Button 
                onClick={handleExtractTable}
                disabled={isLoading}
              >
                Extract Table
              </Button>
              
              <Button 
                onClick={handleExtractImages}
                disabled={isLoading}
              >
                Extract Images
              </Button>
              
              <Button 
                onClick={handleExtractLinks}
                disabled={isLoading}
              >
                Extract Links
              </Button>
              
              <Button 
                onClick={handleExtractMeta}
                disabled={isLoading}
                className="col-span-2"
              >
                Extract Meta
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dom-options">Options (JSON)</Label>
              <Input
                id="dom-options"
                value={options}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions(e.target.value)}
                placeholder="Enter options as JSON"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="semantic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder="Enter content to analyze"
                className="min-h-[100px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => handleDomAction(() => semantic.extract(content, JSON.parse(options)))}
                disabled={isLoading}
              >
                Extract Data
              </Button>
              
              <Button 
                onClick={() => handleDomAction(() => semantic.summarize(JSON.parse(options)))}
                disabled={isLoading}
              >
                Summarize
              </Button>
              
              <Button 
                onClick={() => handleDomAction(() => semantic.recognizeEntities(JSON.parse(options)))}
                disabled={isLoading}
              >
                Recognize Entities
              </Button>
              
              <Button 
                onClick={() => handleDomAction(() => semantic.classify(JSON.parse(options)))}
                disabled={isLoading}
              >
                Classify
              </Button>
              
              <Button 
                onClick={() => handleDomAction(() => semantic.extractSemanticTable(JSON.parse(options)))}
                disabled={isLoading}
                className="col-span-2"
              >
                Extract Semantic Table
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="semantic-options">Options (JSON)</Label>
              <Textarea
                id="semantic-options"
                value={options}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOptions(e.target.value)}
                placeholder="Enter options as JSON"
                className="min-h-[80px]"
              />
            </div>
          </TabsContent>
        </Tabs>
        
        {(result || error) && (
          <div className="mt-4 p-4 bg-muted rounded-md">
            <h3 className="font-semibold mb-2">
              {error ? 'Error' : 'Result'}
            </h3>
            <pre className="text-sm overflow-auto max-h-60">
              {error ? error.message : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
