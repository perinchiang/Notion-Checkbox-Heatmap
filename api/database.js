import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

export default async (req, res) => {
    const token = process.env.ENV_NOTION_TOKEN;
    const databaseId = process.env.ENV_DATABASE_ID;
    const propertyName = process.env.ENV_CHECKBOX_PROPERTY_NAME;

    // 1. 计算 12 个月前的日期 (格式 YYYY-MM-DD)
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    const dateStr = startDate.toISOString().split('T')[0];

    try {
        let allResults = [];
        let hasMore = true;
        let nextCursor = undefined;

        // 2. 循环翻页获取数据，直到取完
        while (hasMore) {
            const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // 3. 关键修改：只筛选 Date 在 6 个月及其之后的数据
                    filter: {
                        property: "Date",
                        date: {
                            on_or_after: dateStr
                        }
                    },
                    // 4. 按日期降序排列，确保即使数据很多，也优先拿最新的
                    sorts: [
                        {
                            property: "Date",
                            direction: "descending"
                        }
                    ],
                    start_cursor: nextCursor,
                    page_size: 100 // 每次取满 100 条
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Notion API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            
            // 将这一页的数据加入总结果
            allResults = [...allResults, ...data.results];
            
            // 检查是否还有下一页
            hasMore = data.has_more;
            nextCursor = data.next_cursor;
        }

        console.log(`总共获取到 ${allResults.length} 条数据 (从 ${dateStr} 至今)`);

        const processedData = processData(allResults, propertyName);
        
        // 设置缓存
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.json(processedData);

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: error.message });
    }
};

const processData = (data, propertyName) => {
    const dataMap = new Map();

    data.forEach(item => {
        if (item.properties.Date && item.properties.Date.date && item.properties[propertyName]) {
            const dateStr = item.properties.Date.date.start;
            
            // 读取数字属性
            const count = item.properties[propertyName].number || 0;
            
            if (dataMap.has(dateStr)) {
                dataMap.set(dateStr, dataMap.get(dateStr) + count);
            } else {
                dataMap.set(dateStr, count);
            }
        }
    });

    return Array.from(dataMap).map(([date, count]) => ({ date, count }));
};

