import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { useDomUtils } from '../hooks/useDomUtils';

export function DomSemanticTools({ tabId }: { tabId: string }) {
  const { dom, semantic, isLoading, error, result } = useDomUtils();
  const { toast } = useToast();
  const [selector, setSelector] = useState('');
  const [options, setOptions] = useState('{}');

  // No internal tab state; tabId is provided by parent

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
      if (requireTab && !tabId) {
        throw new Error('No tab selected');
      }
      const result = await action(tabId);
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
    handleDomAction((tid: string) => dom.extractElement(selector, ['textContent', 'innerHTML'], tid));
  };

  const handleExtractTable = () => {
    if (!selector.trim()) {
      handleError(new Error('Please enter a CSS selector'));
      return;
    }
    handleDomAction((tid: string) => dom.extractTable(selector, JSON.parse(options || '{}'), tid));
  };

  const handleExtractImages = () => {
    handleDomAction((tid: string) => 
      dom.extractImages(selector.trim() || undefined, JSON.parse(options || '{}'), tid)
    );
  };

  const handleExtractLinks = () => {
    handleDomAction((tid: string) => 
      dom.extractLinks(selector.trim() || undefined, JSON.parse(options || '{}'), tid)
    );
  };

  const handleExtractMeta = () => {
    handleDomAction((tid: string) => 
      dom.extractMeta(JSON.parse(options || '{}'), tid)
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
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
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => handleDomAction((tid) => semantic.extract(JSON.parse(options || '{}'), tid))}
                disabled={isLoading}
              >
                Extract Data
              </Button>
              
              <Button 
                onClick={() => handleDomAction((tid) => semantic.summarize(JSON.parse(options || '{}'), tid))}
                disabled={isLoading}
              >
                Summarize
              </Button>
              
              <Button 
                onClick={() => handleDomAction((tid) => semantic.recognizeEntities(JSON.parse(options || '{}'), tid))}
                disabled={isLoading}
              >
                Recognize Entities
              </Button>
              
              <Button 
                onClick={() => handleDomAction((tid) => semantic.classify(JSON.parse(options || '{}'), tid))}
                disabled={isLoading}
              >
                Classify
              </Button>
              
              <Button 
                onClick={() => handleDomAction((tid) => semantic.extractSemanticTable(JSON.parse(options || '{}'), tid))}
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
